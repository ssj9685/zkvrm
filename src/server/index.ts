import html from "@client/index.html";
import { ApiContext } from "@server/api/context";
import { RootApi } from "@server/api/root-api";
import { logger } from "@server/logger";
import { startDatabaseSnapshotScheduler } from "@server/snapshot-scheduler";
import { serve } from "bun";
import { newHttpBatchRpcResponse } from "capnweb";

const port = Number.parseInt(process.env.PORT ?? "3000", 10) || 3000;
const hostname = process.env.HOST ?? "0.0.0.0";

const routes = {
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
