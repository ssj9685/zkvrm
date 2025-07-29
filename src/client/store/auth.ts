import { Store } from "@ga-ut/store";
import { fetcher } from "@client/lib/utils/fetcher";

type User = {
	id: number;
	username: string;
};

export const authStore = new Store({
	isLoggedIn: false,
	user: null as User | null,
	isLoading: true,

	async login(data: { username: string; password: string }) {
		await fetcher.post("/api/auth/login", data);
		this.isLoggedIn = true;
	},

	async register(data: { username: string; password: string }) {
		await fetcher.post("/api/auth/register", data);
	},

	async checkAuth() {
		this.isLoading = true;
		try {
			const user = await fetcher.get<User>("/api/auth/me");
			this.isLoggedIn = true;
			this.user = user;
		} catch (_) {
			this.isLoggedIn = false;
			this.user = null;
		} finally {
			this.isLoading = false;
		}
	},

	async logout() {
		await fetcher.post("/api/auth/logout", {});
		this.isLoggedIn = false;
		this.user = null;
	},
});
