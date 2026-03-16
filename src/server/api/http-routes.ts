import { logger } from "@server/logger";
import { AuthApi } from "./auth-api";
import { ApiContext } from "./context";
import { ApiError, ValidationError } from "./errors";
import { MemoApi } from "./memo-api";

type RoutedRequest = Request & {
	params?: Record<string, string>;
};

type ApiHandler = (
	context: ApiContext,
	req: RoutedRequest,
) => Promise<Response> | Response;

type BunRoute = Record<string, (req: Request) => Promise<Response> | Response>;

function jsonResponse(payload: unknown, init: ResponseInit = {}) {
	return Response.json(payload, init);
}

function noContentResponse() {
	return new Response(null, { status: 204 });
}

async function readJson<T>(req: Request): Promise<T> {
	const text = await req.text();
	if (!text.trim()) {
		return {} as T;
	}

	return JSON.parse(text) as T;
}

function errorPayload(error: ApiError) {
	return {
		code: error.code,
		message: error.message,
		status: error.status,
		name: error.name,
	};
}

function errorResponse(error: unknown, req: Request) {
	if (error instanceof ApiError) {
		return jsonResponse(errorPayload(error), {
			status: error.status,
		});
	}

	logger.error("Unhandled API error", {
		path: new URL(req.url).pathname,
		method: req.method,
		error,
	});

	return jsonResponse(
		{
			code: "INTERNAL_SERVER_ERROR",
			message: "Internal server error",
			status: 500,
			name: "Error",
		},
		{ status: 500 },
	);
}

async function withContext(req: Request, handler: ApiHandler) {
	const context = new ApiContext(req);
	try {
		const response = await handler(context, req as RoutedRequest);
		return context.applyCookies(response);
	} catch (error) {
		return context.applyCookies(errorResponse(error, req));
	}
}

function getParam(req: RoutedRequest, key: string) {
	const value = req.params?.[key];
	if (!value) {
		throw new ValidationError(`Missing route parameter: ${key}`);
	}
	return value;
}

function getPositiveIntParam(req: RoutedRequest, key: string) {
	const raw = getParam(req, key);
	const value = Number(raw);
	if (!Number.isInteger(value) || value <= 0) {
		throw new ValidationError(`${key} must be a positive integer`);
	}
	return value;
}

function contentDisposition(filename: string) {
	const sanitized = filename.replace(/["\r\n]/g, "");
	return `attachment; filename="${sanitized}"`;
}

export const apiRoutes: Record<string, BunRoute> = {
	"/api/auth/register": {
		POST: (req) =>
			withContext(req, async (context) => {
				const authApi = new AuthApi(context);
				await authApi.register(
					await readJson<{ username: string; password: string }>(req),
				);
				return noContentResponse();
			}),
	},
	"/api/auth/login": {
		POST: (req) =>
			withContext(req, async (context) => {
				const authApi = new AuthApi(context);
				const user = await authApi.login(
					await readJson<{ username: string; password: string }>(req),
				);
				return jsonResponse(user);
			}),
	},
	"/api/auth/logout": {
		POST: (req) =>
			withContext(req, async (context) => {
				const authApi = new AuthApi(context);
				await authApi.logout();
				return noContentResponse();
			}),
	},
	"/api/auth/me": {
		GET: (req) =>
			withContext(req, async (context) => {
				const authApi = new AuthApi(context);
				return jsonResponse(await authApi.me());
			}),
	},
	"/api/memos/list": {
		POST: (req) =>
			withContext(req, async (context) => {
				const memoApi = new MemoApi(context);
				const memos = await memoApi.list(await readJson(req));
				return jsonResponse(memos);
			}),
	},
	"/api/memos": {
		POST: (req) =>
			withContext(req, async (context) => {
				const memoApi = new MemoApi(context);
				const memo = await memoApi.create(await readJson(req));
				return jsonResponse(memo);
			}),
	},
	"/api/memos/connect": {
		POST: (req) =>
			withContext(req, async (context) => {
				const memoApi = new MemoApi(context);
				await memoApi.connectMemo(await readJson(req));
				return noContentResponse();
			}),
	},
	"/api/memos/connection-style": {
		PATCH: (req) =>
			withContext(req, async (context) => {
				const memoApi = new MemoApi(context);
				await memoApi.setConnectionStyle(await readJson(req));
				return noContentResponse();
			}),
	},
	"/api/memos/disconnect": {
		POST: (req) =>
			withContext(req, async (context) => {
				const memoApi = new MemoApi(context);
				await memoApi.disconnectMemo(await readJson(req));
				return noContentResponse();
			}),
	},
	"/api/memos/download": {
		GET: (req) =>
			withContext(req, async (context) => {
				const memoApi = new MemoApi(context);
				const payload = await memoApi.download();
				return new Response(payload.data, {
					headers: {
						"Content-Type": payload.contentType,
						"Content-Disposition": contentDisposition(payload.filename),
					},
				});
			}),
	},
	"/api/memos/:id/content": {
		PATCH: (req) =>
			withContext(req, async (context, routedReq) => {
				const memoApi = new MemoApi(context);
				const id = getPositiveIntParam(routedReq, "id");
				const body = await readJson<{ content: string }>(req);
				const memo = await memoApi.update({ id, content: body.content });
				return jsonResponse(memo);
			}),
	},
	"/api/memos/:id/meta": {
		PATCH: (req) =>
			withContext(req, async (context, routedReq) => {
				const memoApi = new MemoApi(context);
				const id = getPositiveIntParam(routedReq, "id");
				const body = await readJson<{
					title?: string;
					tone?: string;
					pin_color?: string;
					is_pinned?: boolean;
					archived_at?: number | null;
				}>(req);
				const memo = await memoApi.setMeta({ id, ...body });
				return jsonResponse(memo);
			}),
	},
	"/api/memos/:id/brain-position": {
		PATCH: (req) =>
			withContext(req, async (context, routedReq) => {
				const memoApi = new MemoApi(context);
				const id = getPositiveIntParam(routedReq, "id");
				const body = await readJson<{
					x: number | null;
					y: number | null;
				}>(req);
				const memo = await memoApi.setBrainPosition({ id, ...body });
				return jsonResponse(memo);
			}),
	},
	"/api/memos/:id/tags": {
		PUT: (req) =>
			withContext(req, async (context, routedReq) => {
				const memoApi = new MemoApi(context);
				const memoId = getPositiveIntParam(routedReq, "id");
				const body = await readJson<{ tagIds: number[] }>(req);
				const memo = await memoApi.setMemoTags({
					memoId,
					tagIds: body.tagIds,
				});
				return jsonResponse(memo);
			}),
	},
	"/api/memos/:id": {
		DELETE: (req) =>
			withContext(req, async (context, routedReq) => {
				const memoApi = new MemoApi(context);
				await memoApi.remove({ id: getPositiveIntParam(routedReq, "id") });
				return noContentResponse();
			}),
	},
	"/api/tags": {
		GET: (req) =>
			withContext(req, async (context) => {
				const memoApi = new MemoApi(context);
				return jsonResponse(await memoApi.listTags());
			}),
		POST: (req) =>
			withContext(req, async (context) => {
				const memoApi = new MemoApi(context);
				const tag = await memoApi.upsertTag(await readJson(req));
				return jsonResponse(tag);
			}),
	},
	"/api/tags/:id": {
		PATCH: (req) =>
			withContext(req, async (context, routedReq) => {
				const memoApi = new MemoApi(context);
				const id = getPositiveIntParam(routedReq, "id");
				const body = await readJson<{ name: string }>(req);
				return jsonResponse(await memoApi.upsertTag({ id, name: body.name }));
			}),
		DELETE: (req) =>
			withContext(req, async (context, routedReq) => {
				const memoApi = new MemoApi(context);
				await memoApi.deleteTag({ id: getPositiveIntParam(routedReq, "id") });
				return noContentResponse();
			}),
	},
};
