import { getUserFromSession } from "@server/auth/session";
import { db } from "@server/db";
import { RpcTarget } from "capnweb";
import type { ApiContext } from "./context";
import { toRpcError, UnauthorizedError } from "./errors";

export type MemoRecord = {
	id: number;
	content: string;
	created_at: number;
};

export type MemoDownloadPayload = {
	filename: string;
	contentType: string;
	data: Uint8Array;
};

type MemoQueryOptions = {
	query?: string;
};

type MemoUpdatePayload = {
	id: number;
	content: string;
};

export class MemoApi extends RpcTarget {
	constructor(private readonly context: ApiContext) {
		super();
	}

	async list(options: MemoQueryOptions = {}): Promise<MemoRecord[]> {
		const user = await this.#requireUser();
		const params: (string | number)[] = [user.id];
		let query = "SELECT * FROM memos WHERE user_id = ?";

		if (options.query) {
			query += " AND content LIKE ?";
			params.push(`%${options.query}%`);
		}

		query += " ORDER BY created_at DESC";
		const memos = db.query(query).all(...params) as MemoRecord[];
		return memos;
	}

	async create({ content }: Pick<MemoRecord, "content">) {
		const user = await this.#requireUser();
		db.run(
			"INSERT INTO memos (user_id, content, created_at) VALUES (?, ?, ?)",
			[user.id, content, Date.now()],
		);
	}

	async update({ id, content }: MemoUpdatePayload) {
		const user = await this.#requireUser();
		db.run("UPDATE memos SET content = ? WHERE id = ? AND user_id = ?", [
			content,
			id,
			user.id,
		]);
	}

	async remove({ id }: Pick<MemoRecord, "id">) {
		const user = await this.#requireUser();
		db.run("DELETE FROM memos WHERE id = ? AND user_id = ?", [id, user.id]);
	}

	async download(): Promise<MemoDownloadPayload> {
		const user = await this.#requireUser();
		const memos = db
			.query("SELECT id, content FROM memos WHERE user_id = ?")
			.all(user.id) as { id: number; content: string }[];

		const content = memos
			.map((memo) => `--- Memo ID: ${memo.id} ---\n${memo.content}`)
			.join("\n\n");

		const compressed = Bun.gzipSync(Buffer.from(content));
		const data = new Uint8Array(compressed.byteLength);
		data.set(compressed);

		return {
			filename: "memos.txt.gz",
			contentType: "application/gzip",
			data,
		};
	}

	async #requireUser() {
		const user = await getUserFromSession(this.context.request);
		if (!user) {
			throw toRpcError(new UnauthorizedError());
		}
		return user;
	}
}
