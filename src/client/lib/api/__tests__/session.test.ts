import { afterEach, beforeEach, expect, test } from "bun:test";
import { getApiError } from "@client/lib/api/errors";
import { api } from "@client/lib/api/session";

type FetchCall = {
	init?: RequestInit;
	input: RequestInfo | URL;
};

const originalFetch = globalThis.fetch;
let calls: FetchCall[] = [];

beforeEach(() => {
	calls = [];
});

afterEach(() => {
	globalThis.fetch = originalFetch;
});

test("memo.setBrainPosition sends a PATCH request and returns the memo", async () => {
	globalThis.fetch = (async (input, init) => {
		calls.push({ input, init });
		return Response.json({
			id: 7,
			title: "Spatial",
			content: "",
			tone: "neutral",
			pin_color: "neutral",
			is_pinned: false,
			created_at: 1,
			updated_at: 1,
			archived_at: null,
			brain_x: 0.25,
			brain_y: 0.75,
			tags: [],
			connections: [],
			backlink_ids: [],
			outlink_ids: [],
			connected_ids: [],
		});
	}) as typeof fetch;

	const result = await api().memo.setBrainPosition({
		id: 7,
		x: 0.25,
		y: 0.75,
	});

	expect(calls).toHaveLength(1);
	expect(calls[0]?.input).toBe("/api/memos/7/brain-position");
	expect(calls[0]?.init?.method).toBe("PATCH");
	expect(calls[0]?.init?.credentials).toBe("same-origin");
	expect(JSON.parse(String(calls[0]?.init?.body))).toEqual({
		x: 0.25,
		y: 0.75,
	});
	expect(result.brain_x).toBe(0.25);
	expect(result.brain_y).toBe(0.75);
});

test("memo.setConnectionStyle sends a PATCH request", async () => {
	globalThis.fetch = (async (input, init) => {
		calls.push({ input, init });
		return new Response(null, { status: 204 });
	}) as typeof fetch;

	await api().memo.setConnectionStyle({
		memoAId: 3,
		memoBId: 9,
		yarnColor: "peach",
	});

	expect(calls).toHaveLength(1);
	expect(calls[0]?.input).toBe("/api/memos/connection-style");
	expect(calls[0]?.init?.method).toBe("PATCH");
	expect(JSON.parse(String(calls[0]?.init?.body))).toEqual({
		memoAId: 3,
		memoBId: 9,
		yarnColor: "peach",
	});
});

test("memo.setBrainPosition turns HTTP errors into getApiError-compatible errors", async () => {
	globalThis.fetch = (async () => {
		return Response.json(
			{
				code: "MEMO_INVALID_BRAIN_POSITION",
				message: "Brain position must be two finite numbers or null",
				status: 400,
				name: "ValidationError",
			},
			{ status: 400 },
		);
	}) as typeof fetch;

	const error = await api()
		.memo.setBrainPosition({
			id: 7,
			x: Number.NaN,
			y: 0.75,
		})
		.catch((caught) => caught);

	expect(error).toBeInstanceOf(Error);
	expect(error.code).toBe("MEMO_INVALID_BRAIN_POSITION");
	expect(error.status).toBe(400);
	expect(error.message).toBe(
		"Brain position must be two finite numbers or null",
	);
	expect(getApiError(error)).toEqual({
		code: "MEMO_INVALID_BRAIN_POSITION",
		message: "Brain position must be two finite numbers or null",
		status: 400,
	});
});

test("memo.download parses filename, content type, and bytes from the response", async () => {
	globalThis.fetch = (async (input, init) => {
		calls.push({ input, init });
		return new Response(new Uint8Array([1, 2, 3, 4]), {
			headers: {
				"Content-Disposition": 'attachment; filename="memos.json.gz"',
				"Content-Type": "application/gzip",
			},
		});
	}) as typeof fetch;

	const payload = await api().memo.download();

	expect(calls).toHaveLength(1);
	expect(calls[0]?.input).toBe("/api/memos/download");
	expect(calls[0]?.init?.method).toBe("GET");
	expect(payload.filename).toBe("memos.json.gz");
	expect(payload.contentType).toBe("application/gzip");
	expect(Array.from(payload.data)).toEqual([1, 2, 3, 4]);
});
