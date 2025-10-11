import { api } from "@client/lib/api/session";
import { Store } from "@ga-ut/store-core";
import type { MemoDownloadPayload, MemoRecord } from "@server/api/memo-api";

async function fetchMemos(query?: string) {
	return await api().memo.list({ query });
}

export const memoStore = new Store({
	memos: [] as MemoRecord[],
	async refresh(query?: string) {
		this.memos = await fetchMemos(query);
	},
	async create(data: Pick<MemoRecord, "content">) {
		await api().memo.create(data);
		this.memos = await fetchMemos();
	},
	async update({ id, content }: Pick<MemoRecord, "id" | "content">) {
		await api().memo.update({ id, content });
		this.memos = await fetchMemos();
	},
	async remove({ id }: Pick<MemoRecord, "id">) {
		await api().memo.remove({ id });
		this.memos = await fetchMemos();
	},
	async download() {
		const payload: MemoDownloadPayload = await api().memo.download();
		return {
			filename: payload.filename,
			blob: new Blob([payload.data], { type: payload.contentType }),
		};
	},
});
