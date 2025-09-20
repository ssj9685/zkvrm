import { getUserFromSession } from "@server/auth/session";
import { db } from "@server/db";
import type { BunRequest } from "bun";

const authRoutes = {
	"/api/auth/register": {
		async POST(req: BunRequest<"/api/auth/register">) {
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
		async POST(req: BunRequest<"/api/auth/login">) {
			const { username, password } = await req.json();
			const user = db
				.query("SELECT * FROM users WHERE username = ?")
				.get(username) as {
				id: number;
				username: string;
				password_hash: string;
			} | null;

			if (!user || !(await Bun.password.verify(password, user.password_hash))) {
				return new Response("Invalid username or password", { status: 401 });
			}

			const sessionId = crypto.randomUUID();
			const expiresAt = Date.now() + 7 * 24 * 60 * 60 * 1000;
			db.run(
				"INSERT INTO sessions (id, user_id, expires_at) VALUES (?, ?, ?)",
				[sessionId, user.id, expiresAt],
			);

			const headers = new Headers();
			headers.set(
				"Set-Cookie",
				`sessionId=${sessionId}; HttpOnly; Path=/; SameSite=Strict; Max-Age=${
					7 * 24 * 60 * 60
				}`,
			);

			return new Response(
				JSON.stringify({ id: user.id, username: user.username }),
				{ status: 200, headers },
			);
		},
	},
	"/api/auth/logout": {
		async POST(req: BunRequest<"/api/auth/logout">) {
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
		async GET(req: BunRequest<"/api/auth/me">) {
			const user = await getUserFromSession(req);
			if (!user) {
				return new Response("Unauthorized", { status: 401 });
			}
			return Response.json(user);
		},
	},
};

export default authRoutes;
