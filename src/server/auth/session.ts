import { db } from "@server/db";

export type AuthenticatedUser = {
	id: number;
	username: string;
};

export async function getUserFromSession(
	req: Request,
): Promise<AuthenticatedUser | null> {
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
		.get(session.user_id) as AuthenticatedUser | null;
	return user;
}
