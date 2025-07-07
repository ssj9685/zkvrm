import { Store } from "@ga-ut/store";
import { fetcher } from "@/shared/utils/fetcher";

type User = {
	id: number;
	username: string;
};

export const authStore = new Store({
	isLoggedIn: false,
	user: null as User | null,

	async checkAuth() {
		try {
			const user = await fetcher.get<User>("/api/auth/me");
			this.isLoggedIn = true;
			this.user = user;
		} catch (_) {
			this.isLoggedIn = false;
			this.user = null;
		}
	},

	async logout() {
		await fetcher.post("/api/auth/logout", {});
		this.isLoggedIn = false;
		this.user = null;
	},
});
