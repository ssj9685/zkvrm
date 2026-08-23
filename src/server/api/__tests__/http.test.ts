import { afterAll, beforeAll, describe, expect, test } from "bun:test";

const port = 33000 + Math.floor(Math.random() * 1000);
const baseUrl = `http://127.0.0.1:${port}`;
const tempDir = `.tmp/zkvrm-api-test-${crypto.randomUUID()}`;
let serverProcess: Bun.Subprocess<"ignore", "pipe", "pipe">;

async function waitForServer() {
	const deadline = Date.now() + 5000;
	let lastError: unknown;
	while (Date.now() < deadline) {
		try {
			const response = await fetch(baseUrl);
			if (response.ok) return;
		} catch (error) {
			lastError = error;
		}
		await Bun.sleep(50);
	}
	throw lastError ?? new Error("server did not start");
}

describe("HTTP API", () => {
	beforeAll(async () => {
		await Bun.$`mkdir -p ${tempDir}`.quiet();
		serverProcess = Bun.spawn(["bun", "src/server/index.ts"], {
			stdout: "pipe",
			stderr: "pipe",
			env: {
				...process.env,
				PORT: String(port),
				HOST: "127.0.0.1",
				SQLITE_PATH: `${tempDir}/zkvrm.sqlite`,
				LOG_FILE: `${tempDir}/zkvrm.log`,
				SERVER_LOG_FILE: `${tempDir}/server.log`,
			},
		});
		await waitForServer();
	});

	afterAll(async () => {
		serverProcess.kill();
		await Bun.$`rm -rf ${tempDir}`.quiet();
	});

	test("dispatches auth methods through JSON endpoints", async () => {
		const response = await fetch(`${baseUrl}/api/auth/me`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: "{}",
		});

		expect(response.status).toBe(200);
		expect(await response.json()).toEqual({
			ok: true,
			result: null,
		});
	});

	test("returns memo lists as JSON arrays", async () => {
		const username = `mobile-${crypto.randomUUID()}`;
		await fetch(`${baseUrl}/api/auth/register`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ username, password: "password" }),
		});
		const loginResponse = await fetch(`${baseUrl}/api/auth/login`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ username, password: "password" }),
		});
		const cookie = loginResponse.headers.get("Set-Cookie") ?? "";

		await fetch(`${baseUrl}/api/memo/create`, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				Cookie: cookie,
			},
			body: JSON.stringify({ content: "hello from phone" }),
		});

		const listResponse = await fetch(`${baseUrl}/api/memo/list`, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				Cookie: cookie,
			},
			body: "{}",
		});
		const payload = await listResponse.json();

		expect(listResponse.status).toBe(200);
		expect(Array.isArray(payload.result)).toBe(true);
		expect(
			payload.result.map((memo: { content: string }) => memo.content),
		).toEqual(["hello from phone"]);
	});

	test("does not dispatch inherited object methods", async () => {
		const response = await fetch(`${baseUrl}/api/constructor/constructor`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: "{}",
		});
		const payload = await response.json();

		expect(response.status).toBe(404);
		expect(payload.error.code).toBe("API_NOT_FOUND");
	});

	test("returns validation errors for malformed JSON", async () => {
		const response = await fetch(`${baseUrl}/api/auth/me`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: "{",
		});
		const payload = await response.json();

		expect(response.status).toBe(400);
		expect(payload.error.code).toBe("API_INVALID_JSON");
	});

	test("returns validation errors for missing login credentials", async () => {
		const response = await fetch(`${baseUrl}/api/auth/login`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: "{}",
		});
		const payload = await response.json();

		expect(response.status).toBe(400);
		expect(payload.error.code).toBe("VALIDATION_ERROR");
	});

	test("returns download data as a JSON byte array", async () => {
		const username = `download-${crypto.randomUUID()}`;
		await fetch(`${baseUrl}/api/auth/register`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ username, password: "password" }),
		});
		const loginResponse = await fetch(`${baseUrl}/api/auth/login`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ username, password: "password" }),
		});
		const cookie = loginResponse.headers.get("Set-Cookie") ?? "";

		await fetch(`${baseUrl}/api/memo/create`, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				Cookie: cookie,
			},
			body: JSON.stringify({ content: "download me" }),
		});

		const downloadResponse = await fetch(`${baseUrl}/api/memo/download`, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				Cookie: cookie,
			},
			body: "{}",
		});
		const payload = await downloadResponse.json();

		expect(downloadResponse.status).toBe(200);
		expect(payload.result.filename).toBe("memos.txt.gz");
		expect(payload.result.contentType).toBe("application/gzip");
		expect(Array.isArray(payload.result.data)).toBe(true);
		const decompressed = Bun.gunzipSync(new Uint8Array(payload.result.data));
		expect(new TextDecoder().decode(decompressed)).toContain("download me");
	});
});
