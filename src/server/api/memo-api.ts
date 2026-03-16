import { getUserFromSession } from "@server/auth/session";
import { db } from "@server/db";
import { normalizeMemoQuery } from "@shared/memo-query";
import type { ApiContext } from "./context";
import { UnauthorizedError, ValidationError } from "./errors";

export const memoToneValues = [
	"neutral",
	"sun",
	"peach",
	"violet",
	"aqua",
	"lime",
] as const;

export const memoSortValues = [
	"updated_desc",
	"created_desc",
	"title_asc",
] as const;

export type MemoTone = (typeof memoToneValues)[number];
export type MemoPinColor = MemoTone;
export type MemoYarnColor = MemoTone;
export type MemoSort = (typeof memoSortValues)[number];

export type MemoTag = {
	id: number;
	name: string;
};

export type MemoConnection = {
	memo_id: number;
	origin: string;
	yarn_color: MemoYarnColor;
};

export type MemoRecord = {
	id: number;
	title: string;
	content: string;
	tone: MemoTone;
	pin_color: MemoPinColor;
	is_pinned: boolean;
	created_at: number;
	updated_at: number;
	archived_at: number | null;
	brain_x: number | null;
	brain_y: number | null;
	tags: MemoTag[];
	connections: MemoConnection[];
	backlink_ids: number[];
	outlink_ids: number[];
	connected_ids: number[];
};

export type MemoDownloadPayload = {
	filename: string;
	contentType: string;
	data: Uint8Array<ArrayBuffer>;
};

export type MemoQueryOptions = {
	query?: string;
	tone?: MemoTone | "all";
	tagIds?: number[];
	pinned?: boolean;
	sort?: MemoSort;
	includeArchived?: boolean;
};

type MemoCreatePayload = {
	content: string;
	title?: string;
	tone?: MemoTone;
};

type MemoUpdatePayload = {
	id: number;
	content: string;
};

export type MemoMetaPayload = {
	id: number;
	title?: string;
	tone?: MemoTone;
	pin_color?: MemoPinColor;
	is_pinned?: boolean;
	archived_at?: number | null;
};

export type MemoTagUpsertPayload = {
	id?: number;
	name: string;
};

export type MemoTagBindingPayload = {
	memoId: number;
	tagIds: number[];
};

export type MemoLinkPayload = {
	sourceId: number;
	targetId: number;
};

type MemoTagDeletePayload = {
	id: number;
};

export type MemoConnectPayload = {
	memoAId: number;
	memoBId: number;
	yarnColor?: MemoYarnColor;
};

export type MemoBrainPositionPayload = {
	id: number;
	x: number | null;
	y: number | null;
};

export type MemoConnectionStylePayload = {
	memoAId: number;
	memoBId: number;
	yarnColor: MemoYarnColor;
};

type MemoRow = {
	id: number;
	title: string;
	content: string;
	tone: string;
	pin_color: string;
	is_pinned: number;
	created_at: number;
	updated_at: number;
	archived_at: number | null;
	brain_x: number | null;
	brain_y: number | null;
};

type MemoLinkRow = {
	source_memo_id: number;
	target_memo_id: number;
	origin: string;
	yarn_color: string;
};

export class MemoApi {
	constructor(private readonly context: ApiContext) {}

	async list(options: MemoQueryOptions = {}): Promise<MemoRecord[]> {
		const user = await this.#requireUser();
		const params: (string | number)[] = [user.id];
		const where: string[] = ["m.user_id = ?"];
		const normalizedQuery = normalizeMemoQuery(options.query);
		const normalizedTagIds = this.#normalizeTagIds(options.tagIds);
		const normalizedTone = this.#normalizeToneFilter(options.tone);
		const normalizedSort = this.#normalizeSort(options.sort);

		if (!options.includeArchived) {
			where.push("m.archived_at IS NULL");
		}

		if (normalizedQuery) {
			where.push("(m.title LIKE ? OR m.content LIKE ?)");
			params.push(`%${normalizedQuery}%`, `%${normalizedQuery}%`);
		}

		if (normalizedTone) {
			where.push("m.tone = ?");
			params.push(normalizedTone);
		}

		if (typeof options.pinned === "boolean") {
			where.push("m.is_pinned = ?");
			params.push(options.pinned ? 1 : 0);
		}

		if (normalizedTagIds.length > 0) {
			const placeholders = normalizedTagIds.map(() => "?").join(", ");
			where.push(
				`EXISTS (SELECT 1 FROM memo_tags mt WHERE mt.user_id = ? AND mt.memo_id = m.id AND mt.tag_id IN (${placeholders}))`,
			);
			params.push(user.id, ...normalizedTagIds);
		}

		const orderBy =
			normalizedSort === "created_desc"
				? "m.created_at DESC, m.id DESC"
				: normalizedSort === "title_asc"
					? "m.title COLLATE NOCASE ASC, m.updated_at DESC, m.id DESC"
					: "m.updated_at DESC, m.id DESC";

		const query = `
			SELECT
				m.id,
				m.title,
				m.content,
				m.tone,
				m.pin_color,
				m.is_pinned,
				m.created_at,
				m.updated_at,
				m.archived_at,
				m.brain_x,
				m.brain_y
			FROM memos m
			WHERE ${where.join(" AND ")}
			ORDER BY ${orderBy}
		`;

		const rows = db.query(query).all(...params) as MemoRow[];
		return this.#hydrateMemos(user.id, rows);
	}

	async create(payload: MemoCreatePayload): Promise<MemoRecord> {
		const user = await this.#requireUser();
		const now = Date.now();
		const tone = this.#normalizeTone(payload.tone);
		const pinColor = tone;
		const content = payload.content ?? "";
		const title = this.#normalizeTitle(payload.title ?? content);

		const result = db.run(
			"INSERT INTO memos (user_id, title, content, tone, pin_color, is_pinned, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
			[user.id, title, content, tone, pinColor, 0, now, now],
		) as { lastInsertRowid?: number | bigint };

		const memoId = Number(result.lastInsertRowid ?? 0);
		if (!memoId) {
			throw new ValidationError("Failed to create memo", "MEMO_CREATE_FAILED");
		}

		return this.#getMemoById(user.id, memoId);
	}

	async update({ id, content }: MemoUpdatePayload): Promise<MemoRecord> {
		const user = await this.#requireUser();
		const now = Date.now();
		const normalizedContent = content ?? "";
		const changes = db.run(
			"UPDATE memos SET content = ?, updated_at = ? WHERE id = ? AND user_id = ?",
			[normalizedContent, now, id, user.id],
		).changes;

		if (changes === 0) {
			throw new ValidationError("Memo not found", "MEMO_NOT_FOUND");
		}

		return this.#getMemoById(user.id, id);
	}

	async setMeta(payload: MemoMetaPayload): Promise<MemoRecord> {
		const user = await this.#requireUser();
		const updates: string[] = [];
		const params: (string | number | null)[] = [];

		if (payload.title !== undefined) {
			updates.push("title = ?");
			params.push(this.#normalizeTitle(payload.title));
		}

		if (payload.tone !== undefined) {
			updates.push("tone = ?");
			params.push(this.#normalizeTone(payload.tone));
		}

		if (payload.pin_color !== undefined) {
			updates.push("pin_color = ?");
			params.push(this.#normalizePinColor(payload.pin_color));
		}

		if (payload.is_pinned !== undefined) {
			updates.push("is_pinned = ?");
			params.push(payload.is_pinned ? 1 : 0);
		}

		if (payload.archived_at !== undefined) {
			updates.push("archived_at = ?");
			params.push(payload.archived_at ?? null);
		}

		if (updates.length === 0) {
			return this.#getMemoById(user.id, payload.id);
		}

		updates.push("updated_at = ?");
		params.push(Date.now());
		params.push(payload.id, user.id);

		const changes = db.run(
			`UPDATE memos SET ${updates.join(", ")} WHERE id = ? AND user_id = ?`,
			params,
		).changes;

		if (changes === 0) {
			throw new ValidationError("Memo not found", "MEMO_NOT_FOUND");
		}

		return this.#getMemoById(user.id, payload.id);
	}

	async setBrainPosition({
		id,
		x,
		y,
	}: MemoBrainPositionPayload): Promise<MemoRecord> {
		const user = await this.#requireUser();
		this.#assertMemoOwnership(user.id, id);
		const normalized = this.#normalizeBrainPosition({ x, y });
		const changes = db.run(
			"UPDATE memos SET brain_x = ?, brain_y = ? WHERE id = ? AND user_id = ?",
			[normalized.x, normalized.y, id, user.id],
		).changes;

		if (changes === 0) {
			throw new ValidationError("Memo not found", "MEMO_NOT_FOUND");
		}

		return this.#getMemoById(user.id, id);
	}

	async remove({ id }: Pick<MemoRecord, "id">) {
		const user = await this.#requireUser();
		db.run("DELETE FROM memo_tags WHERE user_id = ? AND memo_id = ?", [
			user.id,
			id,
		]);
		db.run(
			"DELETE FROM memo_links WHERE user_id = ? AND (source_memo_id = ? OR target_memo_id = ?)",
			[user.id, id, id],
		);
		db.run("DELETE FROM memos WHERE id = ? AND user_id = ?", [id, user.id]);
	}

	async listTags(): Promise<MemoTag[]> {
		const user = await this.#requireUser();
		return db
			.query(
				"SELECT id, name FROM tags WHERE user_id = ? ORDER BY name COLLATE NOCASE ASC",
			)
			.all(user.id) as MemoTag[];
	}

	async upsertTag(payload: MemoTagUpsertPayload): Promise<MemoTag> {
		const user = await this.#requireUser();
		const now = Date.now();
		const name = this.#normalizeTagName(payload.name);

		if (payload.id !== undefined) {
			try {
				const changes = db.run(
					"UPDATE tags SET name = ?, updated_at = ? WHERE id = ? AND user_id = ?",
					[name, now, payload.id, user.id],
				).changes;
				if (changes === 0) {
					throw new ValidationError("Tag not found", "MEMO_TAG_NOT_FOUND");
				}
			} catch (error) {
				if (error instanceof Error && error.message.includes("UNIQUE")) {
					throw new ValidationError("Tag already exists", "MEMO_TAG_EXISTS");
				}
				throw error;
			}

			const updated = db
				.query("SELECT id, name FROM tags WHERE id = ? AND user_id = ?")
				.get(payload.id, user.id) as MemoTag | null;
			if (!updated) {
				throw new ValidationError("Tag not found", "MEMO_TAG_NOT_FOUND");
			}
			return updated;
		}

		try {
			db.run(
				"INSERT INTO tags (user_id, name, created_at, updated_at) VALUES (?, ?, ?, ?)",
				[user.id, name, now, now],
			);
		} catch (error) {
			if (!(error instanceof Error) || !error.message.includes("UNIQUE")) {
				throw error;
			}
		}

		const tag = db
			.query("SELECT id, name FROM tags WHERE user_id = ? AND name = ?")
			.get(user.id, name) as MemoTag | null;
		if (!tag) {
			throw new ValidationError(
				"Failed to create tag",
				"MEMO_TAG_CREATE_FAILED",
			);
		}
		return tag;
	}

	async deleteTag({ id }: MemoTagDeletePayload): Promise<void> {
		const user = await this.#requireUser();
		const tag = db
			.query("SELECT id FROM tags WHERE user_id = ? AND id = ?")
			.get(user.id, id) as { id: number } | null;
		if (!tag) {
			throw new ValidationError("Tag not found", "MEMO_TAG_NOT_FOUND");
		}

		db.run("DELETE FROM memo_tags WHERE user_id = ? AND tag_id = ?", [
			user.id,
			id,
		]);
		db.run("DELETE FROM tags WHERE user_id = ? AND id = ?", [user.id, id]);
	}

	async setMemoTags({
		memoId,
		tagIds,
	}: MemoTagBindingPayload): Promise<MemoRecord> {
		const user = await this.#requireUser();
		this.#assertMemoOwnership(user.id, memoId);
		const normalizedTagIds = this.#normalizeTagIds(tagIds);

		db.run("DELETE FROM memo_tags WHERE user_id = ? AND memo_id = ?", [
			user.id,
			memoId,
		]);
		if (normalizedTagIds.length > 0) {
			const placeholders = normalizedTagIds.map(() => "?").join(", ");
			const validTagRows = db
				.query(
					`SELECT id FROM tags WHERE user_id = ? AND id IN (${placeholders}) ORDER BY id ASC`,
				)
				.all(user.id, ...normalizedTagIds) as { id: number }[];
			const now = Date.now();
			for (const row of validTagRows) {
				db.run(
					"INSERT INTO memo_tags (user_id, memo_id, tag_id, created_at) VALUES (?, ?, ?, ?)",
					[user.id, memoId, row.id, now],
				);
			}
		}

		db.run("UPDATE memos SET updated_at = ? WHERE id = ? AND user_id = ?", [
			Date.now(),
			memoId,
			user.id,
		]);
		return this.#getMemoById(user.id, memoId);
	}

	async linkMemo({ sourceId, targetId }: MemoLinkPayload): Promise<void> {
		await this.connectMemo({ memoAId: sourceId, memoBId: targetId });
	}

	async unlinkMemo({ sourceId, targetId }: MemoLinkPayload): Promise<void> {
		await this.disconnectMemo({ memoAId: sourceId, memoBId: targetId });
	}

	async connectMemo({
		memoAId,
		memoBId,
		yarnColor,
	}: MemoConnectPayload): Promise<void> {
		const user = await this.#requireUser();
		if (memoAId === memoBId) {
			return;
		}

		this.#assertMemoOwnership(user.id, memoAId);
		this.#assertMemoOwnership(user.id, memoBId);

		const exists = db
			.query(
				`SELECT id
				 FROM memo_links
				 WHERE user_id = ?
				   AND (
					 (source_memo_id = ? AND target_memo_id = ?)
					 OR
					 (source_memo_id = ? AND target_memo_id = ?)
				   )
				 LIMIT 1`,
			)
			.get(user.id, memoAId, memoBId, memoBId, memoAId) as {
			id: number;
		} | null;
		if (exists) {
			return;
		}

		db.run(
			"INSERT INTO memo_links (user_id, source_memo_id, target_memo_id, origin, yarn_color, created_at) VALUES (?, ?, ?, 'manual', ?, ?)",
			[
				user.id,
				memoAId,
				memoBId,
				this.#normalizeYarnColor(yarnColor),
				Date.now(),
			],
		);
	}

	async disconnectMemo({
		memoAId,
		memoBId,
	}: MemoConnectPayload): Promise<void> {
		const user = await this.#requireUser();
		if (memoAId === memoBId) {
			return;
		}

		this.#assertMemoOwnership(user.id, memoAId);
		this.#assertMemoOwnership(user.id, memoBId);
		db.run(
			`DELETE FROM memo_links
			 WHERE user_id = ?
			   AND (
				 (source_memo_id = ? AND target_memo_id = ?)
				 OR
				 (source_memo_id = ? AND target_memo_id = ?)
			   )`,
			[user.id, memoAId, memoBId, memoBId, memoAId],
		);
	}

	async setConnectionStyle({
		memoAId,
		memoBId,
		yarnColor,
	}: MemoConnectionStylePayload): Promise<void> {
		const user = await this.#requireUser();
		if (memoAId === memoBId) {
			return;
		}

		this.#assertMemoOwnership(user.id, memoAId);
		this.#assertMemoOwnership(user.id, memoBId);
		const changes = db.run(
			`UPDATE memo_links
			 SET yarn_color = ?
			 WHERE user_id = ?
			   AND (
				 (source_memo_id = ? AND target_memo_id = ?)
				 OR
				 (source_memo_id = ? AND target_memo_id = ?)
			   )`,
			[
				this.#normalizeYarnColor(yarnColor),
				user.id,
				memoAId,
				memoBId,
				memoBId,
				memoAId,
			],
		).changes;
		if (changes === 0) {
			throw new ValidationError("Memo link not found", "MEMO_LINK_NOT_FOUND");
		}
	}

	async download(): Promise<MemoDownloadPayload> {
		const memos = await this.list({
			includeArchived: true,
			sort: "updated_desc",
		});
		const content = JSON.stringify(
			{
				exported_at: Date.now(),
				version: 3,
				memos,
			},
			null,
			2,
		);

		const compressed = Bun.gzipSync(Buffer.from(content));
		const data = new Uint8Array(compressed.byteLength);
		data.set(compressed);

		return {
			filename: "memos.json.gz",
			contentType: "application/gzip",
			data,
		};
	}

	#assertMemoOwnership(userId: number, memoId: number) {
		const memo = db
			.query("SELECT id FROM memos WHERE id = ? AND user_id = ?")
			.get(memoId, userId) as { id: number } | null;
		if (!memo) {
			throw new ValidationError("Memo not found", "MEMO_NOT_FOUND");
		}
	}

	#normalizeTone(tone?: MemoTone): MemoTone {
		if (!tone) {
			return "neutral";
		}
		if (memoToneValues.includes(tone)) {
			return tone;
		}
		throw new ValidationError("Invalid memo tone", "MEMO_INVALID_TONE");
	}

	#normalizePinColor(pinColor?: MemoPinColor): MemoPinColor {
		if (!pinColor) {
			return "neutral";
		}
		if (memoToneValues.includes(pinColor)) {
			return pinColor;
		}
		throw new ValidationError("Invalid memo pin color", "MEMO_INVALID_PIN_COLOR");
	}

	#normalizeYarnColor(yarnColor?: MemoYarnColor): MemoYarnColor {
		if (!yarnColor) {
			return "neutral";
		}
		if (memoToneValues.includes(yarnColor)) {
			return yarnColor;
		}
		throw new ValidationError(
			"Invalid memo yarn color",
			"MEMO_INVALID_YARN_COLOR",
		);
	}

	#normalizeToneFilter(tone?: MemoQueryOptions["tone"]): MemoTone | undefined {
		if (!tone || tone === "all") {
			return undefined;
		}
		if (memoToneValues.includes(tone)) {
			return tone;
		}
		throw new ValidationError("Invalid memo tone", "MEMO_INVALID_TONE");
	}

	#normalizeSort(sort?: MemoSort): MemoSort {
		if (!sort) {
			return "updated_desc";
		}
		if (memoSortValues.includes(sort)) {
			return sort;
		}
		throw new ValidationError("Invalid memo sort", "MEMO_INVALID_SORT");
	}

	#normalizeTitle(value: string): string {
		const trimmed = value.trim();
		if (!trimmed) {
			return "제목 없는 메모";
		}
		return trimmed.slice(0, 120);
	}

	#normalizeTagName(value: string): string {
		const trimmed = value.trim();
		if (!trimmed) {
			throw new ValidationError("Tag cannot be empty", "MEMO_TAG_INVALID");
		}
		return trimmed.slice(0, 36);
	}

	#normalizeTagIds(tagIds?: number[]): number[] {
		if (!tagIds || tagIds.length === 0) {
			return [];
		}
		const seen = new Set<number>();
		for (const id of tagIds) {
			if (Number.isInteger(id) && id > 0) {
				seen.add(id);
			}
		}
		return [...seen];
	}

	#normalizeBrainPosition({ x, y }: { x: number | null; y: number | null }) {
		if (x === null && y === null) {
			return { x: null, y: null };
		}
		if (
			typeof x === "number" &&
			Number.isFinite(x) &&
			typeof y === "number" &&
			Number.isFinite(y)
		) {
			return { x, y };
		}
		throw new ValidationError(
			"Brain position must be two finite numbers or null",
			"MEMO_INVALID_BRAIN_POSITION",
		);
	}

	#getMemoById(userId: number, memoId: number): MemoRecord {
		const row = db
			.query(
				"SELECT id, title, content, tone, pin_color, is_pinned, created_at, updated_at, archived_at, brain_x, brain_y FROM memos WHERE user_id = ? AND id = ?",
			)
			.get(userId, memoId) as MemoRow | null;
		if (!row) {
			throw new ValidationError("Memo not found", "MEMO_NOT_FOUND");
		}
		return this.#hydrateMemos(userId, [row])[0];
	}

	#hydrateMemos(userId: number, rows: MemoRow[]): MemoRecord[] {
		if (rows.length === 0) {
			return [];
		}

		const memoIds = rows.map((row) => row.id);
		const placeholders = memoIds.map(() => "?").join(", ");
		const tagRows = db
			.query(
				`SELECT mt.memo_id, t.id, t.name
				 FROM memo_tags mt
				 JOIN tags t ON t.id = mt.tag_id
				 WHERE mt.user_id = ? AND mt.memo_id IN (${placeholders})
				 ORDER BY t.name COLLATE NOCASE ASC`,
			)
			.all(userId, ...memoIds) as {
			memo_id: number;
			id: number;
			name: string;
		}[];

		const linkRows = db
			.query(
				`SELECT source_memo_id, target_memo_id, origin, yarn_color
				 FROM memo_links
				 WHERE user_id = ?
				   AND (
					 source_memo_id IN (${placeholders})
					 OR
					 target_memo_id IN (${placeholders})
				   )`,
			)
			.all(userId, ...memoIds, ...memoIds) as MemoLinkRow[];

		const tagsByMemoId = new Map<number, MemoTag[]>();
		for (const row of tagRows) {
			const list = tagsByMemoId.get(row.memo_id) ?? [];
			list.push({ id: row.id, name: row.name });
			tagsByMemoId.set(row.memo_id, list);
		}

		const backlinksByMemoId = new Map<number, number[]>();
		const outlinksByMemoId = new Map<number, number[]>();
		const connectionsByMemoId = new Map<number, MemoConnection[]>();
		for (const row of linkRows) {
			const backlinkList = backlinksByMemoId.get(row.target_memo_id) ?? [];
			backlinkList.push(row.source_memo_id);
			backlinksByMemoId.set(row.target_memo_id, backlinkList);

			const outlinkList = outlinksByMemoId.get(row.source_memo_id) ?? [];
			outlinkList.push(row.target_memo_id);
			outlinksByMemoId.set(row.source_memo_id, outlinkList);

			const normalizedYarnColor = this.#normalizeYarnColor(
				row.yarn_color as MemoYarnColor,
			);
			const sourceConnections = connectionsByMemoId.get(row.source_memo_id) ?? [];
			sourceConnections.push({
				memo_id: row.target_memo_id,
				origin: row.origin,
				yarn_color: normalizedYarnColor,
			});
			connectionsByMemoId.set(row.source_memo_id, sourceConnections);

			const targetConnections = connectionsByMemoId.get(row.target_memo_id) ?? [];
			targetConnections.push({
				memo_id: row.source_memo_id,
				origin: row.origin,
				yarn_color: normalizedYarnColor,
			});
			connectionsByMemoId.set(row.target_memo_id, targetConnections);
		}

		return rows.map((row) => ({
			id: row.id,
			title: this.#normalizeTitle(row.title),
			content: row.content,
			tone: memoToneValues.includes(row.tone as MemoTone)
				? (row.tone as MemoTone)
				: "neutral",
			pin_color: this.#normalizePinColor(row.pin_color as MemoPinColor),
			is_pinned: Boolean(row.is_pinned),
			created_at: row.created_at,
			updated_at: row.updated_at,
			archived_at: row.archived_at,
			brain_x: row.brain_x,
			brain_y: row.brain_y,
			tags: tagsByMemoId.get(row.id) ?? [],
			connections: connectionsByMemoId.get(row.id) ?? [],
			backlink_ids: [...new Set(backlinksByMemoId.get(row.id) ?? [])],
			outlink_ids: [...new Set(outlinksByMemoId.get(row.id) ?? [])],
			connected_ids: [
				...new Set([
					...(backlinksByMemoId.get(row.id) ?? []),
					...(outlinksByMemoId.get(row.id) ?? []),
				]),
			],
		}));
	}

	async #requireUser() {
		const user = await getUserFromSession(this.context.request);
		if (!user) {
			throw new UnauthorizedError();
		}
		return user;
	}
}
