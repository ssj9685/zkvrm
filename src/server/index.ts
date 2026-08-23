import html from "@client/index.html";
import { ApiContext } from "@server/api/context";
import { ValidationError } from "@server/api/errors";
import { RootApi } from "@server/api/root-api";
import { logger } from "@server/logger";
import { startDatabaseSnapshotScheduler } from "@server/snapshot-scheduler";
import { serve } from "bun";

const clientRoot = new URL("../client/", import.meta.url);
const serviceWorkerSource = new URL(
	"../client/service-worker.ts",
	import.meta.url,
);
const serviceWorkerTranspiler = new Bun.Transpiler({
	loader: "ts",
	target: "browser",
});
let cachedServiceWorkerResponse: Response | null = null;

async function serveClientFile(
	pathname: string,
	options: { cacheControl?: string } = {},
): Promise<Response> {
	if (pathname.includes("..")) {
		return new Response("Not Found", { status: 404 });
	}

	const fileUrl = new URL(pathname, clientRoot);
	const file = Bun.file(fileUrl);

	if (!(await file.exists())) {
		return new Response("Not Found", { status: 404 });
	}

	const headers = new Headers();
	if (file.type) {
		headers.set("Content-Type", file.type);
	}
	headers.set("Cache-Control", options.cacheControl ?? "public, max-age=3600");

	return new Response(file, { headers });
}

async function serveAssetRequest(req: Request): Promise<Response> {
	const url = new URL(req.url);
	const relativePath = url.pathname.replace(/^\/+/, "");
	const cacheControl = relativePath.startsWith("assets/")
		? "public, max-age=604800, immutable"
		: undefined;
	return serveClientFile(relativePath, { cacheControl });
}

function headResponse(response: Response): Response {
	return new Response(null, {
		status: response.status,
		headers: response.headers,
	});
}

async function serveServiceWorker(): Promise<Response> {
	if (process.env.NODE_ENV === "production" && cachedServiceWorkerResponse) {
		return cachedServiceWorkerResponse.clone();
	}

	const file = Bun.file(serviceWorkerSource);
	if (!(await file.exists())) {
		return new Response("Not Found", { status: 404 });
	}

	const source = await file.text();
	const compiled = serviceWorkerTranspiler.transformSync(source);
	const headers = new Headers({
		"Content-Type": "text/javascript; charset=utf-8",
		"Cache-Control":
			process.env.NODE_ENV === "production" ? "no-cache" : "no-store",
	});
	const response = new Response(compiled, { headers });
	if (process.env.NODE_ENV === "production") {
		cachedServiceWorkerResponse = response.clone();
	}
	return response;
}

async function handleApiRequest(req: Request): Promise<Response> {
	const url = new URL(req.url);
	const [, resource, method] =
		url.pathname.match(/^\/api\/([^/]+)\/([^/]+)$/) ?? [];
	if (!resource || !method) {
		return Response.json(
			{
				ok: false,
				error: {
					code: "API_NOT_FOUND",
					message: "Not Found",
					status: 404,
				},
			},
			{ status: 404 },
		);
	}

	const context = new ApiContext(req);
	const api = new RootApi(context);
	const action = getApiAction(api, resource, method);

	if (!action) {
		return Response.json(
			{
				ok: false,
				error: {
					code: "API_NOT_FOUND",
					message: "Not Found",
					status: 404,
				},
			},
			{ status: 404 },
		);
	}

	try {
		const payload = await readJsonPayload(req);
		const result = await action(payload);
		return context.applyCookies(
			Response.json({
				ok: true,
				result: serializeApiResult(result),
			}),
		);
	} catch (error) {
		const apiError = serializeApiError(error);
		return context.applyCookies(
			Response.json(
				{
					ok: false,
					error: apiError,
				},
				{ status: apiError.status },
			),
		);
	}
}

function getApiAction(
	api: RootApi,
	resource: string,
	method: string,
): ((payload?: unknown) => unknown) | undefined {
	if (resource === "auth") {
		if (method === "register")
			return (payload) =>
				api.auth.register(
					payload as Parameters<RootApi["auth"]["register"]>[0],
				);
		if (method === "login")
			return (payload) =>
				api.auth.login(payload as Parameters<RootApi["auth"]["login"]>[0]);
		if (method === "logout") return () => api.auth.logout();
		if (method === "me") return () => api.auth.me();
	}
	if (resource === "memo") {
		if (method === "list")
			return (payload) =>
				api.memo.list(payload as Parameters<RootApi["memo"]["list"]>[0]);
		if (method === "create")
			return (payload) =>
				api.memo.create(payload as Parameters<RootApi["memo"]["create"]>[0]);
		if (method === "update")
			return (payload) =>
				api.memo.update(payload as Parameters<RootApi["memo"]["update"]>[0]);
		if (method === "remove")
			return (payload) =>
				api.memo.remove(payload as Parameters<RootApi["memo"]["remove"]>[0]);
		if (method === "download") return () => api.memo.download();
	}
	return undefined;
}

async function readJsonPayload(req: Request) {
	const text = await req.text();
	if (!text) return {};
	try {
		return JSON.parse(text);
	} catch {
		throw new ValidationError("Invalid JSON body", "API_INVALID_JSON");
	}
}

type JsonValue =
	| null
	| string
	| number
	| boolean
	| JsonValue[]
	| { [key: string]: JsonValue };

function serializeApiResult(result: unknown): JsonValue {
	if (result === undefined || result === null) {
		return null;
	}
	if (
		typeof result === "string" ||
		typeof result === "number" ||
		typeof result === "boolean"
	) {
		return result;
	}
	if (result instanceof Uint8Array) {
		return Array.from(result);
	}
	if (Array.isArray(result)) {
		return result.map(serializeApiResult);
	}
	if (result && typeof result === "object") {
		return Object.fromEntries(
			Object.entries(result).map(([key, value]) => [
				key,
				serializeApiResult(value),
			]),
		);
	}
	return null;
}

function serializeApiError(error: unknown) {
	if (error instanceof Error) {
		try {
			const parsed = JSON.parse(error.message);
			if (typeof parsed.status === "number") {
				return parsed;
			}
		} catch (_) {
			// Fall through to generic error shape.
		}
		const status =
			"status" in error && typeof error.status === "number"
				? error.status
				: 500;
		const code =
			"code" in error && typeof error.code === "string"
				? error.code
				: "API_ERROR";
		return {
			code,
			message: error.message,
			status,
			name: error.name,
		};
	}
	return {
		code: "API_ERROR",
		message: "Request failed",
		status: 500,
	};
}

const port = Number.parseInt(process.env.PORT ?? "3000", 10) || 3000;
const hostname = process.env.HOST ?? "0.0.0.0";

const routes = {
	"/manifest.webmanifest": {
		async GET() {
			return serveClientFile("manifest.webmanifest", {
				cacheControl: "public, max-age=86400",
			});
		},
		async HEAD() {
			const response = await serveClientFile("manifest.webmanifest", {
				cacheControl: "public, max-age=86400",
			});
			return headResponse(response);
		},
	},
	"/service-worker.js": {
		async GET() {
			return serveServiceWorker();
		},
		async HEAD() {
			const response = await serveServiceWorker();
			return headResponse(response);
		},
	},
	"/assets/*": {
		GET: serveAssetRequest,
		async HEAD(req: Request) {
			const response = await serveAssetRequest(req);
			return headResponse(response);
		},
	},
	"/api/:resource/:method": {
		POST: handleApiRequest,
		async GET() {
			return new Response("Method Not Allowed", { status: 405 });
		},
		async PUT() {
			return new Response("Method Not Allowed", { status: 405 });
		},
		async DELETE() {
			return new Response("Method Not Allowed", { status: 405 });
		},
	},
	"/api": {
		async POST(req: Request) {
			return handleApiRequest(req);
		},
		async GET() {
			return new Response("Method Not Allowed", { status: 405 });
		},
		async PUT() {
			return new Response("Method Not Allowed", { status: 405 });
		},
		async DELETE() {
			return new Response("Method Not Allowed", { status: 405 });
		},
	},
	"/api/*": {
		async GET() {
			return new Response("Not Found", { status: 404 });
		},
		async POST() {
			return new Response("Not Found", { status: 404 });
		},
		async PUT() {
			return new Response("Not Found", { status: 404 });
		},
		async DELETE() {
			return new Response("Not Found", { status: 404 });
		},
	},
	"/*": html,
};

const server = serve({
	port,
	hostname,
	routes,
	development: process.env.NODE_ENV !== "production" && {
		hmr: true,
		console: true,
	},
});

logger.info(`Server running at ${server.url}`);

startDatabaseSnapshotScheduler();
