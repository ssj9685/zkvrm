import { routes } from "@server/routes";
import { startDatabaseSnapshotScheduler } from "@server/snapshot-scheduler";
import { serve } from "bun";

const port = Number.parseInt(process.env.PORT ?? "3000", 10) || 3000;
const hostname = process.env.HOST ?? "0.0.0.0";

const server = serve({
	port,
	hostname,
	routes,
	development: process.env.NODE_ENV !== "production" && {
		hmr: true,
		console: true,
	},
});

console.log(`🚀 Server running at ${server.url}`);

startDatabaseSnapshotScheduler();
