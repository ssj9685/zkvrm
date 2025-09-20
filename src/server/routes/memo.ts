import { getUserFromSession } from "@server/auth/session";
import { db } from "@server/db";
import type { BunRequest } from "bun";

const memoRoutes = {
	"/api/memo": {
		async GET(req: BunRequest<"/api/memo">) {
			const user = await getUserFromSession(req);
			if (!user) return new Response("Unauthorized", { status: 401 });

			const url = new URL(req.url);
			const searchQuery = url.searchParams.get("query");

			let query = "SELECT * FROM memos WHERE user_id = ?";
			const params: (string | number)[] = [user.id];

			if (searchQuery) {
				query += " AND content LIKE ?";
				params.push(`%${searchQuery}%`);
			}
			query += " ORDER BY created_at DESC";

			const memos = db.query(query).all(...params);
			return Response.json(memos);
		},
		async POST(req: BunRequest<"/api/memo">) {
			const user = await getUserFromSession(req);
			if (!user) return new Response("Unauthorized", { status: 401 });

			const { content } = await req.json();
			db.run(
				"INSERT INTO memos (user_id, content, created_at) VALUES (?, ?, ?)",
				[user.id, content, Date.now()],
			);
			return new Response("OK");
		},
	},
	"/api/memo/:id": {
		async PUT(req: BunRequest<"/api/memo/:id">) {
			const user = await getUserFromSession(req);
			if (!user) return new Response("Unauthorized", { status: 401 });

			const { id } = req.params;
			const { content } = await req.json();
			db.run("UPDATE memos SET content = ? WHERE id = ? AND user_id = ?", [
				content,
				id,
				user.id,
			]);
			return new Response("OK");
		},
		async DELETE(req: BunRequest<"/api/memo/:id">) {
			const user = await getUserFromSession(req);
			if (!user) return new Response("Unauthorized", { status: 401 });

			const { id } = req.params;
			db.run("DELETE FROM memos WHERE id = ? AND user_id = ?", [id, user.id]);
			return new Response("OK");
		},
	},
	"/api/memo/download": {
		async GET(req: BunRequest<"/api/memo/download">) {
			const user = await getUserFromSession(req);
			if (!user) return new Response("Unauthorized", { status: 401 });

			const memos = db
				.query("SELECT * FROM memos WHERE user_id = ?")
				.all(user.id) as { id: number; content: string }[];

			const allContent = memos
				.map((memo) => `--- Memo ID: ${memo.id} ---\n${memo.content}`)
				.join("\n\n");
			const compressed = Bun.gzipSync(Buffer.from(allContent));

			const headers = new Headers({
				"Content-Type": "application/gzip",
				"Content-Disposition": 'attachment; filename="memos.txt.gz"',
			});

			const ab = new ArrayBuffer(compressed.byteLength);
			new Uint8Array(ab).set(compressed);
			return new Response(ab, { headers });
		},
	},
};

export default memoRoutes;
