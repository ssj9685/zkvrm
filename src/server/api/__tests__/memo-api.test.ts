import { afterAll, beforeEach, describe, expect, test } from "bun:test";
import { randomUUID } from "node:crypto";
import { mkdirSync, readFileSync, rmSync } from "node:fs";

const tempDir = `${process.cwd()}/.tmp`;
mkdirSync(tempDir, { recursive: true });
const testDbPath = `${tempDir}/memo-api-${Date.now()}-${Math.random().toString(16).slice(2)}.sqlite`;
process.env.SQLITE_PATH = testDbPath;

const { db } = await import("@server/db");
const { ApiContext } = await import("@server/api/context");
const { MemoApi } = await import("@server/api/memo-api");
const requiredMigration = "20260310090000_add_brain_style_colors.sql";

async function waitForSchemaReady() {
	for (let attempt = 0; attempt < 200; attempt += 1) {
		const applied = db
			.query("SELECT name FROM schema_migrations WHERE name = ?")
			.get(requiredMigration) as { name: string } | null;
		const memoLinkColumns = db
			.query("PRAGMA table_info(memo_links)")
			.all() as Array<{ name: string }>;
		const hasOriginColumn = memoLinkColumns.some(
			(column) => column.name === "origin",
		);
		const memoColumns = db
			.query("PRAGMA table_info(memos)")
			.all() as Array<{ name: string }>;
		const hasBrainXColumn = memoColumns.some(
			(column) => column.name === "brain_x",
		);
		const hasBrainYColumn = memoColumns.some(
			(column) => column.name === "brain_y",
		);
		const hasPinColorColumn = memoColumns.some(
			(column) => column.name === "pin_color",
		);
		const hasYarnColorColumn = memoLinkColumns.some(
			(column) => column.name === "yarn_color",
		);
		if (
			applied &&
			hasOriginColumn &&
			hasBrainXColumn &&
			hasBrainYColumn &&
			hasPinColorColumn &&
			hasYarnColorColumn
		) {
			return;
		}
		await Bun.sleep(25);
	}
	throw new Error("test schema did not reach expected migration state");
}

function createAuthedMemoApi() {
	const username = `memo-test-${randomUUID()}`;
	const insertUser = db.run(
		"INSERT INTO users (username, password_hash) VALUES (?, ?)",
		[username, "hash"],
	) as { lastInsertRowid?: number | bigint };
	const userId = Number(insertUser.lastInsertRowid ?? 0);
	if (!userId) {
		throw new Error("failed to create test user");
	}

	const sessionId = randomUUID();
	db.run("INSERT INTO sessions (id, user_id, expires_at) VALUES (?, ?, ?)", [
		sessionId,
		userId,
		Date.now() + 86_400_000,
	]);

	const request = new Request("http://localhost/api", {
		headers: {
			Cookie: `sessionId=${sessionId}`,
		},
	});

	return {
		userId,
		api: new MemoApi(new ApiContext(request)),
	};
}

async function getMemoById(api: InstanceType<typeof MemoApi>, memoId: number) {
	const memos = await api.list({
		includeArchived: true,
		sort: "updated_desc",
	});
	const memo = memos.find((row) => row.id === memoId);
	expect(memo).toBeDefined();
	if (!memo) {
		throw new Error(`memo ${memoId} not found`);
	}
	return memo;
}

beforeEach(async () => {
	await waitForSchemaReady();
	db.run("DELETE FROM memo_links");
	db.run("DELETE FROM memo_tags");
	db.run("DELETE FROM tags");
	db.run("DELETE FROM memos");
	db.run("DELETE FROM sessions");
	db.run("DELETE FROM users");
});

afterAll(() => {
	db.close(false);
	rmSync(testDbPath, { force: true });
});

describe("memo api link and tag integrity", () => {
	test("create assigns pin color from memo tone", async () => {
		const { api } = createAuthedMemoApi();
		const memo = await api.create({
			title: "Warm note",
			content: "",
			tone: "peach",
		});

		expect(memo.tone).toBe("peach");
		expect(memo.pin_color).toBe("peach");
		expect(memo.connections).toEqual([]);
	});

	test("manual connect creates stable edge", async () => {
		const { api } = createAuthedMemoApi();
		const target = await api.create({ title: "Beta", content: "" });
		const source = await api.create({ title: "Alpha", content: "Initial" });

		await api.connectMemo({ memoAId: source.id, memoBId: target.id });
		await api.update({ id: source.id, content: "[[Beta]] should stay text only" });

		const sourceUpdated = await getMemoById(api, source.id);
		const targetUpdated = await getMemoById(api, target.id);
		expect(sourceUpdated.connected_ids).toContain(target.id);
		expect(targetUpdated.connected_ids).toContain(source.id);
	});

	test("connectMemo stores yarn color in hydrated connections", async () => {
		const { api } = createAuthedMemoApi();
		const source = await api.create({ title: "Alpha", content: "" });
		const target = await api.create({ title: "Beta", content: "" });

		await api.connectMemo({
			memoAId: source.id,
			memoBId: target.id,
			yarnColor: "aqua",
		});

		const sourceUpdated = await getMemoById(api, source.id);
		const targetUpdated = await getMemoById(api, target.id);
		expect(sourceUpdated.connections).toContainEqual({
			memo_id: target.id,
			origin: "manual",
			yarn_color: "aqua",
		});
		expect(targetUpdated.connections).toContainEqual({
			memo_id: source.id,
			origin: "manual",
			yarn_color: "aqua",
		});
	});

	test("disconnectMemo removes both directions", async () => {
		const { api } = createAuthedMemoApi();
		const beta = await api.create({ title: "Beta", content: "" });
		const source = await api.create({ title: "Source", content: "" });

		await api.connectMemo({ memoAId: source.id, memoBId: beta.id });
		let sourceUpdated = await getMemoById(api, source.id);
		let betaUpdated = await getMemoById(api, beta.id);
		expect(sourceUpdated.connected_ids).toContain(beta.id);
		expect(betaUpdated.connected_ids).toContain(source.id);

		await api.disconnectMemo({ memoAId: beta.id, memoBId: source.id });
		sourceUpdated = await getMemoById(api, source.id);
		betaUpdated = await getMemoById(api, beta.id);
		expect(sourceUpdated.connected_ids).not.toContain(beta.id);
		expect(betaUpdated.connected_ids).not.toContain(source.id);
	});

	test("create and update with [[Title]] does not auto-create links", async () => {
		const { api } = createAuthedMemoApi();
		const beta = await api.create({ title: "Beta", content: "" });
		const source = await api.create({ title: "Source", content: "[[Beta]]" });

		let sourceUpdated = await getMemoById(api, source.id);
		let betaUpdated = await getMemoById(api, beta.id);
		expect(sourceUpdated.connected_ids).not.toContain(beta.id);
		expect(betaUpdated.connected_ids).not.toContain(source.id);

		await api.update({ id: source.id, content: "[[Beta]] again" });
		sourceUpdated = await getMemoById(api, source.id);
		betaUpdated = await getMemoById(api, beta.id);
		expect(sourceUpdated.connected_ids).not.toContain(beta.id);
		expect(betaUpdated.connected_ids).not.toContain(source.id);
	});

	test("migration converts wiki origin links to manual", async () => {
		const { api, userId } = createAuthedMemoApi();
		const target = await api.create({ title: "Beta", content: "" });
		const source = await api.create({ title: "Alpha", content: "" });

		db.run(
			"INSERT INTO memo_links (user_id, source_memo_id, target_memo_id, origin, created_at) VALUES (?, ?, ?, 'wiki', ?)",
			[userId, source.id, target.id, Date.now()],
		);
		const migrationSql = readFileSync(
			`${process.cwd()}/scripts/migrations/20260303090000_promote_wiki_links_to_manual.sql`,
			"utf8",
		);
		db.exec(migrationSql);

		const row = db
			.query(
				"SELECT origin FROM memo_links WHERE user_id = ? AND source_memo_id = ? AND target_memo_id = ?",
			)
			.get(userId, source.id, target.id) as { origin: string } | null;
		expect(row?.origin).toBe("manual");

		const updated = await getMemoById(api, source.id);
		expect(updated.connected_ids).toContain(target.id);
	});

	test("deleteTag removes tag and memo_tag bindings", async () => {
		const { api, userId } = createAuthedMemoApi();
		const memo = await api.create({ title: "Tagged", content: "" });
		const tag = await api.upsertTag({ name: "project" });
		await api.setMemoTags({ memoId: memo.id, tagIds: [tag.id] });

		await api.deleteTag({ id: tag.id });

		const tags = await api.listTags();
		expect(tags).toHaveLength(0);
		const updated = await getMemoById(api, memo.id);
		expect(updated.tags).toHaveLength(0);

		const bindings = db
			.query(
				"SELECT COUNT(*) as count FROM memo_tags WHERE user_id = ? AND memo_id = ? AND tag_id = ?",
			)
			.get(userId, memo.id, tag.id) as { count: number };
		expect(bindings.count).toBe(0);
	});

	test("setMeta updates pin color", async () => {
		const { api } = createAuthedMemoApi();
		const memo = await api.create({ title: "Pinned color", content: "" });

		const updated = await api.setMeta({
			id: memo.id,
			pin_color: "lime",
		});

		expect(updated.pin_color).toBe("lime");
	});

	test("setConnectionStyle updates the stored yarn color", async () => {
		const { api } = createAuthedMemoApi();
		const source = await api.create({ title: "Alpha", content: "" });
		const target = await api.create({ title: "Beta", content: "" });

		await api.connectMemo({
			memoAId: source.id,
			memoBId: target.id,
			yarnColor: "sun",
		});
		await api.setConnectionStyle({
			memoAId: target.id,
			memoBId: source.id,
			yarnColor: "violet",
		});

		const row = db
			.query(
				`SELECT yarn_color
				 FROM memo_links
				 WHERE (source_memo_id = ? AND target_memo_id = ?)
				    OR (source_memo_id = ? AND target_memo_id = ?)`,
			)
			.get(source.id, target.id, target.id, source.id) as {
			yarn_color: string;
		} | null;
		expect(row?.yarn_color).toBe("violet");

		const sourceUpdated = await getMemoById(api, source.id);
		expect(sourceUpdated.connections).toContainEqual({
			memo_id: target.id,
			origin: "manual",
			yarn_color: "violet",
		});
	});

	test("setBrainPosition stores and clears normalized positions", async () => {
		const { api } = createAuthedMemoApi();
		const memo = await api.create({ title: "Spatial", content: "" });

		const positioned = await api.setBrainPosition({
			id: memo.id,
			x: 0.38,
			y: 0.71,
		});
		expect(positioned.brain_x).toBe(0.38);
		expect(positioned.brain_y).toBe(0.71);

		const cleared = await api.setBrainPosition({
			id: memo.id,
			x: null,
			y: null,
		});
		expect(cleared.brain_x).toBeNull();
		expect(cleared.brain_y).toBeNull();
	});

	test("setBrainPosition does not change updated_at", async () => {
		const { api } = createAuthedMemoApi();
		const memo = await api.create({ title: "Pinned space", content: "" });
		const previousUpdatedAt = memo.updated_at;

		await Bun.sleep(5);
		const updated = await api.setBrainPosition({
			id: memo.id,
			x: 0.19,
			y: 0.24,
		});

		expect(updated.updated_at).toBe(previousUpdatedAt);
	});

	test("setBrainPosition rejects writes to another user's memo", async () => {
		const { api } = createAuthedMemoApi();
		const other = createAuthedMemoApi();
		const memo = await api.create({ title: "Private", content: "" });

		await expect(
			other.api.setBrainPosition({
				id: memo.id,
				x: 0.44,
				y: 0.58,
			}),
		).rejects.toThrow();
	});

	test("setConnectionStyle rejects writes to another user's memo", async () => {
		const { api } = createAuthedMemoApi();
		const other = createAuthedMemoApi();
		const source = await api.create({ title: "Alpha", content: "" });
		const target = await api.create({ title: "Beta", content: "" });

		await api.connectMemo({ memoAId: source.id, memoBId: target.id });

		await expect(
			other.api.setConnectionStyle({
				memoAId: source.id,
				memoBId: target.id,
				yarnColor: "peach",
			}),
		).rejects.toThrow();
	});
});
