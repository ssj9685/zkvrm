import html from "@client/index.html";
import { ApiContext } from "@server/api/context";
import { RootApi } from "@server/api/root-api";
import { logger } from "@server/logger";
import { startDatabaseSnapshotScheduler } from "@server/snapshot-scheduler";
import { serve } from "bun";
import { newHttpBatchRpcResponse } from "capnweb";

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
	"/api": {
		async POST(req: Request) {
			const context = new ApiContext(req);
			const api = new RootApi(context);
			const response = await newHttpBatchRpcResponse(req, api);
			return context.applyCookies(response);
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
