import { Database } from "bun:sqlite";
import { serve } from "bun";
import html from "@/assets/index.html";

const db = new Database("zkvrm.sqlite", { create: true });

// Run migrations before starting the server
await import("../migrate");

// --- Authentication Helper ---
async function getUserFromSession(
	req: Request,
): Promise<{ id: number; username: string } | null> {
	const cookie = req.headers.get("Cookie");
	if (!cookie) return null;

	const sessionId = cookie.match(/sessionId=([^;]+)/)?.[1];
	if (!sessionId) return null;

	const session = db
		.query("SELECT * FROM sessions WHERE id = ? AND expires_at > ?")
		.get(sessionId, Date.now()) as {
		id: string;
		user_id: number;
		expires_at: number;
	} | null;
	if (!session) return null;

	const user = db
		.query("SELECT id, username FROM users WHERE id = ?")
		.get(session.user_id) as { id: number; username: string } | null;
	return user;
}

const server = serve({
	routes: {
		"/*": html,

		// --- Auth Routes ---
		"/api/auth/register": {
			async POST(req) {
				const { username, password } = await req.json();
				if (!username || !password) {
					return new Response("Username and password are required", {
						status: 400,
					});
				}

				const existingUser = db
					.query("SELECT id FROM users WHERE username = ?")
					.get(username);
				if (existingUser) {
					return new Response("Username already taken", { status: 409 });
				}

				const passwordHash = await Bun.password.hash(password);
				db.run("INSERT INTO users (username, password_hash) VALUES (?, ?)", [
					username,
					passwordHash,
				]);
				return new Response("User registered successfully", { status: 201 });
			},
		},
		"/api/auth/login": {
			async POST(req) {
				const { username, password } = await req.json();
				const user = db
					.query("SELECT * FROM users WHERE username = ?")
					.get(username) as {
					id: number;
					username: string;
					password_hash: string;
				} | null;

				if (
					!user ||
					!(await Bun.password.verify(password, user.password_hash))
				) {
					return new Response("Invalid username or password", { status: 401 });
				}

				const sessionId = crypto.randomUUID();
				const expiresAt = Date.now() + 7 * 24 * 60 * 60 * 1000; // 7 days
				db.run(
					"INSERT INTO sessions (id, user_id, expires_at) VALUES (?, ?, ?)",
					[sessionId, user.id, expiresAt],
				);

				const headers = new Headers();
				headers.set(
					"Set-Cookie",
					`sessionId=${sessionId}; HttpOnly; Path=/; SameSite=Strict; Max-Age=${7 * 24 * 60 * 60}`,
				);

				return new Response(
					JSON.stringify({ id: user.id, username: user.username }),
					{ status: 200, headers },
				);
			},
		},
		"/api/auth/logout": {
			async POST(req) {
				const cookie = req.headers.get("Cookie");
				const sessionId = cookie?.match(/sessionId=([^;]+)/)?.[1];
				if (sessionId) {
					db.run("DELETE FROM sessions WHERE id = ?", [sessionId]);
				}
				const headers = new Headers();
				headers.set("Set-Cookie", "sessionId=; HttpOnly; Path=/; Max-Age=0");
				return new Response("Logged out", { status: 200, headers });
			},
		},
		"/api/auth/me": {
			async GET(req) {
				const user = await getUserFromSession(req);
				if (!user) {
					return new Response("Unauthorized", { status: 401 });
				}
				return Response.json(user);
			},
		},

		// --- Protected Memo Routes ---
		"/api/memo": {
			async GET(req) {
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

				const memos = db.query(query).all(...params);
				return Response.json(memos);
			},
			async POST(req) {
				const user = await getUserFromSession(req);
				if (!user) return new Response("Unauthorized", { status: 401 });

				const { content } = await req.json();
				db.run("INSERT INTO memos (user_id, content) VALUES (?, ?)", [
					user.id,
					content,
				]);
				return new Response("OK");
			},
		},
		"/api/memo/:id": {
			async PUT(req) {
				const user = await getUserFromSession(req);
				if (!user) return new Response("Unauthorized", { status: 401 });

				const { id } = req.params;
				const { content } = await req.json();
				// Ensure the memo belongs to the user before updating
				db.run("UPDATE memos SET content = ? WHERE id = ? AND user_id = ?", [
					content,
					id,
					user.id,
				]);
				return new Response("OK");
			},
			async DELETE(req) {
				const user = await getUserFromSession(req);
				if (!user) return new Response("Unauthorized", { status: 401 });

				const { id } = req.params;
				// Ensure the memo belongs to the user before deleting
				db.run("DELETE FROM memos WHERE id = ? AND user_id = ?", [id, user.id]);
				return new Response("OK");
			},
		},
		"/api/memo/download": {
			async GET(req) {
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

				return new Response(compressed, { headers });
			},
		},
	},

	development: process.env.NODE_ENV !== "production" && {
		hmr: true,
		console: true,
	},
});

console.log(`🚀 Server running at ${server.url}`);
