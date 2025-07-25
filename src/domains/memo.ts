import { Store } from "@ga-ut/store";
import { fetcher } from "@/shared/utils/fetcher";

type Memo = {
	id: number;
	content: string;
	created_at: number;
};

async function refresh(query?: string) {
	const url = query
		? `/api/memo?query=${encodeURIComponent(query)}`
		: "/api/memo";
	return await fetcher.get<Memo[]>(url);
}

export const memoStore = new Store({
	memos: [] as Memo[],
	async refresh(query?: string) {
		this.memos = await refresh(query);
	},
	async create(data: Pick<Memo, "content">) {
		await fetcher.post("/api/memo", data);
		this.memos = await refresh();
	},
	async update({ id, content }: Pick<Memo, "id" | "content">) {
		await fetcher.put(`/api/memo/${id}`, { content });
		this.memos = await refresh();
	},
	async remove({ id }: Pick<Memo, "id">) {
		await fetcher.delete(`/api/memo/${id}`, {});
		this.memos = await refresh();
	},
	async download() {
		return await fetcher.get<Blob>("/api/memo/download");
	},
});
