import { afterEach, describe, expect, test } from "bun:test";
import { api } from "@client/lib/api/session";

const originalFetch = globalThis.fetch;

describe("api session", () => {
	afterEach(() => {
		globalThis.fetch = originalFetch;
	});

	test("posts method calls to resource-specific JSON endpoints", async () => {
		const requests: { url: string; init?: RequestInit }[] = [];
		globalThis.fetch = (async (
			url: string | URL | Request,
			init?: RequestInit,
		) => {
			requests.push({ url: String(url), init });
			return Response.json({
				ok: true,
				result: { id: 1, username: "shin" },
			});
		}) as typeof fetch;

		const user = await api().auth.me();

		expect(user).toEqual({ id: 1, username: "shin" });
		expect(requests).toHaveLength(1);
		expect(requests[0].url).toBe("/api/auth/me");
		expect(requests[0].init?.method).toBe("POST");
		expect(requests[0].init?.credentials).toBe("same-origin");
		expect(requests[0].init?.headers).toEqual({
			"Content-Type": "application/json",
		});
		expect(requests[0].init?.body).toBe("{}");
	});

	test("revives download byte payloads from JSON arrays", async () => {
		globalThis.fetch = (async () =>
			Response.json({
				ok: true,
				result: {
					filename: "memos.txt.gz",
					contentType: "application/gzip",
					data: [31, 139],
				},
			})) as unknown as typeof fetch;

		const payload = await api().memo.download();

		expect(payload.data).toBeInstanceOf(Uint8Array);
		expect(Array.from(payload.data)).toEqual([31, 139]);
	});

	test("preserves list results as arrays", async () => {
		globalThis.fetch = (async () =>
			Response.json({
				ok: true,
				result: [
					{
						id: 1,
						content: "hello",
						created_at: 123,
					},
				],
			})) as unknown as typeof fetch;

		const memos = await api().memo.list();

		expect(Array.isArray(memos)).toBe(true);
		expect(memos.map((memo) => memo.content)).toEqual(["hello"]);
	});
});
