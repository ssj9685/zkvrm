import { Database } from "bun:sqlite";
import { serve } from "bun";
import html from "@/assets/index.html";

const db = new Database("zkvrm.sqlite", { create: true });
db.run(
	"CREATE TABLE IF NOT EXISTS memos (id INTEGER PRIMARY KEY AUTOINCREMENT, content TEXT)",
);

const server = serve({
	routes: {
		"/*": html,
		"/api/memo": {
			async GET() {
				const memos = db.query("SELECT * FROM memos").all();
				return Response.json(memos);
			},
			async POST(req) {
				console.log(req);
				const { content } = await req.json();
				db.run("INSERT INTO memos (content) VALUES (?)", [content]);
				return new Response("OK");
			},
		},
		"/api/memo/:id": {
			async PUT(req) {
				const { id } = req.params;
				const { content } = await req.json();
				db.run("UPDATE memos SET content = ? WHERE id = ?", [content, id]);
				return new Response("OK");
			},
			async DELETE(req) {
				const { id } = req.params;
				db.run("DELETE FROM memos WHERE id = ?", [id]);
				return new Response("OK");
			},
		},
		"/api/memo/download": {
			async GET() {
				const memos = db.query("SELECT * FROM memos").all() as {
					id: number;
					content: string;
				}[];

				// Concatenate all memos into a single string
				const allContent = memos
					.map((memo) => `--- Memo ID: ${memo.id} ---\n${memo.content}`)
					.join("\n\n");

				// Compress the string using gzip
				const compressed = Bun.gzipSync(Buffer.from(allContent));

				const headers = new Headers({
					"Content-Type": "application/gzip",
					"Content-Disposition": 'attachment; filename="memos.txt.gz"',
				});

				return new Response(compressed, { headers });
			},
		},
	},

	development: process.env.NODE_ENV !== "production" && {
		// Enable browser hot reloading in development
		hmr: true,

		// Echo console logs from the browser to the server
		console: true,
	},
});

console.log(`🚀 Server running at ${server.url}`);
