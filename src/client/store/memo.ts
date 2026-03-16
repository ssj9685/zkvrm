import { api } from "@client/lib/api/session";
import { Store } from "@ga-ut/store-core";
import type {
	MemoBrainPositionPayload,
	MemoConnectionStylePayload,
	MemoDownloadPayload,
	MemoMetaPayload,
	MemoQueryOptions,
	MemoRecord,
	MemoSort,
	MemoTag,
	MemoTone,
} from "@server/api/memo-api";
import { normalizeMemoQuery } from "@shared/memo-query";

const defaultFilters: Required<Pick<MemoQueryOptions, "sort">> &
	Omit<MemoQueryOptions, "sort"> = {
	sort: "updated_desc",
};

function normalizeFilters(filters?: MemoQueryOptions): MemoQueryOptions {
	const query = normalizeMemoQuery(filters?.query);
	const tone =
		filters?.tone && filters.tone !== "all" ? filters.tone : undefined;
	const pinned =
		typeof filters?.pinned === "boolean" ? filters.pinned : undefined;
	const tagIds = filters?.tagIds
		? [
				...new Set(
					filters.tagIds.filter((id) => Number.isInteger(id) && id > 0),
				),
			]
		: undefined;
	const sort = filters?.sort ?? defaultFilters.sort;
	const includeArchived = filters?.includeArchived ? true : undefined;

	return {
		query,
		tone,
		pinned,
		tagIds: tagIds && tagIds.length > 0 ? tagIds : undefined,
		sort,
		includeArchived,
	};
}

async function fetchMemos(filters: MemoQueryOptions) {
	return await api().memo.list(filters);
}

async function fetchBrainMemos() {
	// Brain uses the full memo pool independent from list filters.
	return await fetchMemos({ sort: defaultFilters.sort });
}

async function fetchTags() {
	return await api().memo.listTags();
}

export const memoStore = new Store({
	memos: [] as MemoRecord[],
	brainMemos: [] as MemoRecord[],
	tags: [] as MemoTag[],
	activeFilters: defaultFilters as MemoQueryOptions,
	isLoading: false,

	async refresh(nextFilters?: MemoQueryOptions) {
		const merged = normalizeFilters({ ...this.activeFilters, ...nextFilters });
		this.activeFilters = merged;
		this.isLoading = true;
		try {
			const [memos, brainMemos] = await Promise.all([
				fetchMemos(merged),
				fetchBrainMemos(),
			]);
			this.memos = memos;
			this.brainMemos = brainMemos;
		} finally {
			this.isLoading = false;
		}
	},

	async refreshTags() {
		this.tags = await fetchTags();
	},

	async refreshAll(nextFilters?: MemoQueryOptions) {
		const merged = normalizeFilters({ ...this.activeFilters, ...nextFilters });
		this.activeFilters = merged;
		this.isLoading = true;
		try {
			const [memos, brainMemos, tags] = await Promise.all([
				fetchMemos(merged),
				fetchBrainMemos(),
				fetchTags(),
			]);
			this.memos = memos;
			this.brainMemos = brainMemos;
			this.tags = tags;
		} finally {
			this.isLoading = false;
		}
	},

	async refreshBrainMemos() {
		this.brainMemos = await fetchBrainMemos();
	},

	async setSort(sort: MemoSort) {
		await memoStore.getState().refresh({ sort });
	},

	async setTone(tone: MemoTone | undefined) {
		await memoStore.getState().refresh({ tone });
	},

	async setPinnedFilter(pinned: boolean | undefined) {
		await memoStore.getState().refresh({ pinned });
	},

	async setTagFilter(tagIds: number[]) {
		await memoStore.getState().refresh({ tagIds });
	},

	async setQuery(query?: string) {
		await memoStore.getState().refresh({ query });
	},

	async create(data: { content: string; title?: string; tone?: MemoTone }) {
		const created = await api().memo.create(data);
		await memoStore.getState().refresh();
		return created;
	},

	async update({ id, content }: Pick<MemoRecord, "id" | "content">) {
		await api().memo.update({ id, content });
		await memoStore.getState().refresh();
	},

	async setMeta(payload: MemoMetaPayload) {
		await api().memo.setMeta(payload);
		await memoStore.getState().refresh();
	},

	async setBrainPosition(payload: MemoBrainPositionPayload) {
		const previousMemos = this.memos;
		const previousBrainMemos = this.brainMemos;
		const applyPosition = (memo: MemoRecord): MemoRecord =>
			memo.id === payload.id
				? {
						...memo,
						brain_x: payload.x,
						brain_y: payload.y,
					}
				: memo;
		this.memos = this.memos.map(applyPosition);
		this.brainMemos = this.brainMemos.map(applyPosition);
		try {
			await api().memo.setBrainPosition(payload);
		} catch (error) {
			this.memos = previousMemos;
			this.brainMemos = previousBrainMemos;
			throw error;
		}
	},

	async setMemoTags({ memoId, tagIds }: { memoId: number; tagIds: number[] }) {
		await api().memo.setMemoTags({ memoId, tagIds });
		await memoStore.getState().refresh();
	},

	async upsertTag(payload: { id?: number; name: string }) {
		const tag = await api().memo.upsertTag(payload);
		this.tags = await fetchTags();
		return tag;
	},

	async linkMemo({
		sourceId,
		targetId,
	}: {
		sourceId: number;
		targetId: number;
	}) {
		await api().memo.connectMemo({ memoAId: sourceId, memoBId: targetId });
		await memoStore.getState().refresh();
	},

	async unlinkMemo({
		sourceId,
		targetId,
	}: {
		sourceId: number;
		targetId: number;
	}) {
		await api().memo.disconnectMemo({ memoAId: sourceId, memoBId: targetId });
		await memoStore.getState().refresh();
	},

	async connectMemo({
		memoAId,
		memoBId,
		yarnColor,
	}: {
		memoAId: number;
		memoBId: number;
		yarnColor?: MemoConnectionStylePayload["yarnColor"];
	}) {
		await api().memo.connectMemo({ memoAId, memoBId, yarnColor });
		await memoStore.getState().refresh();
	},

	async setConnectionStyle(payload: MemoConnectionStylePayload) {
		await api().memo.setConnectionStyle(payload);
		await memoStore.getState().refresh();
	},

	async disconnectMemo({
		memoAId,
		memoBId,
	}: {
		memoAId: number;
		memoBId: number;
	}) {
		await api().memo.disconnectMemo({ memoAId, memoBId });
		await memoStore.getState().refresh();
	},

	async deleteTag({ id }: { id: number }) {
		await api().memo.deleteTag({ id });
		await memoStore.getState().refreshAll();
	},

	async remove({ id }: Pick<MemoRecord, "id">) {
		await api().memo.remove({ id });
		await memoStore.getState().refresh();
	},

	async download() {
		const payload: MemoDownloadPayload = await api().memo.download();
		return {
			filename: payload.filename,
			blob: new Blob([payload.data], { type: payload.contentType }),
		};
	},
});
