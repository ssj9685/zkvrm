import { Store } from "@ga-ut/store";
import { fetcher } from "@/shared/utils/fetcher";

type Memo = {
	id: number;
	content: string;
};

async function refresh() {
	return await fetcher.get<Memo[]>("/api/memo");
}

export const memoStore = new Store({
	memos: [] as Memo[],
	async refresh() {
		this.memos = await refresh();
	},
	async create(data: Omit<Memo, "id">) {
		await fetcher.post("/api/memo", data);
		this.memos = await refresh();
	},
	async update({ id, content }: Memo) {
		await fetcher.put(`/api/memo/${id}`, { content });
		this.memos = await refresh();
	},
	async remove({ id }: Omit<Memo, "content">) {
		await fetcher.delete(`/api/memo/${id}`);
		this.memos = await refresh();
	},
});
