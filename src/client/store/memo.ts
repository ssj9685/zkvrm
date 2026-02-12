import { api } from "@client/lib/api/session";
import { Store } from "@ga-ut/store-core";
import type { MemoDownloadPayload, MemoRecord } from "@server/api/memo-api";
import { normalizeMemoQuery } from "@shared/memo-query";

async function fetchMemos(query?: string) {
	return await api().memo.list({ query });
}

export const memoStore = new Store({
	memos: [] as MemoRecord[],
	activeQuery: undefined as string | undefined,
	async refresh(query?: string) {
		this.activeQuery = normalizeMemoQuery(query);
		this.memos = await fetchMemos(this.activeQuery);
	},
	async create(data: Pick<MemoRecord, "content">) {
		await api().memo.create(data);
		this.memos = await fetchMemos(this.activeQuery);
	},
	async update({ id, content }: Pick<MemoRecord, "id" | "content">) {
		await api().memo.update({ id, content });
		this.memos = await fetchMemos(this.activeQuery);
	},
	async remove({ id }: Pick<MemoRecord, "id">) {
		await api().memo.remove({ id });
		this.memos = await fetchMemos(this.activeQuery);
	},
	async download() {
		const payload: MemoDownloadPayload = await api().memo.download();
		return {
			filename: payload.filename,
			blob: new Blob([payload.data], { type: payload.contentType }),
		};
	},
});
