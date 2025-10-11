import {
	type AuthenticatedUser,
	getUserFromSession,
} from "@server/auth/session";
import { db } from "@server/db";
import { logger } from "@server/logger";
import { RpcTarget } from "capnweb";
import type { ApiContext } from "./context";

const SESSION_COOKIE_NAME = "sessionId";
const SESSION_MAX_AGE_SECONDS = 7 * 24 * 60 * 60;

type Credentials = {
	username: string;
	password: string;
};

export class AuthApi extends RpcTarget {
	constructor(private readonly context: ApiContext) {
		super();
	}

	async register({ username, password }: Credentials) {
		const normalizedUsername = username?.trim();
		if (!normalizedUsername || !password) {
			throw new Error("Username and password are required");
		}

		const existingUser = db
			.query("SELECT id FROM users WHERE username = ?")
			.get(normalizedUsername);
		if (existingUser) {
			throw new Error("Username already taken");
		}

		const passwordHash = await Bun.password.hash(password);
		db.run("INSERT INTO users (username, password_hash) VALUES (?, ?)", [
			normalizedUsername,
			passwordHash,
		]);
		logger.info(`Registered user ${normalizedUsername}`);
	}

	async login({ username, password }: Credentials): Promise<AuthenticatedUser> {
		const normalizedUsername = username?.trim();
		if (!normalizedUsername || !password) {
			throw new Error("Username and password are required");
		}

		const user = db
			.query("SELECT id, username, password_hash FROM users WHERE username = ?")
			.get(normalizedUsername) as {
			id: number;
			username: string;
			password_hash: string;
		} | null;

		if (!user || !(await Bun.password.verify(password, user.password_hash))) {
			throw new Error("Invalid username or password");
		}

		const sessionId = crypto.randomUUID();
		const expiresAt = Date.now() + SESSION_MAX_AGE_SECONDS * 1000;
		db.run("INSERT INTO sessions (id, user_id, expires_at) VALUES (?, ?, ?)", [
			sessionId,
			user.id,
			expiresAt,
		]);

		this.context.addCookie(
			`${SESSION_COOKIE_NAME}=${sessionId}; HttpOnly; Path=/; SameSite=Strict; Max-Age=${SESSION_MAX_AGE_SECONDS}`,
		);

		logger.info(`User ${user.username} logged in`);
		return { id: user.id, username: user.username };
	}

	async logout() {
		const sessionId = this.context.getCookie(SESSION_COOKIE_NAME);
		if (sessionId) {
			db.run("DELETE FROM sessions WHERE id = ?", [sessionId]);
		}

		this.context.addCookie(
			`${SESSION_COOKIE_NAME}=; HttpOnly; Path=/; SameSite=Strict; Max-Age=0`,
		);
	}

	async me(): Promise<AuthenticatedUser | null> {
		const user = await getUserFromSession(this.context.request);
		return user ?? null;
	}
}
