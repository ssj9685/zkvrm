import { api } from "@client/lib/api/session";
import { Store } from "@ga-ut/store-core";
import type { AuthenticatedUser } from "@server/auth/session";

type User = AuthenticatedUser;

export const authStore = new Store({
	isLoggedIn: false,
	user: null as User | null,
	isLoading: true,

	async login(data: { username: string; password: string }) {
		const user = await api().auth.login(data);
		this.isLoggedIn = true;
		this.user = user;
	},

	async register(data: { username: string; password: string }) {
		await api().auth.register(data);
	},

	async checkAuth() {
		this.isLoading = true;
		try {
			const user = await api().auth.me();
			if (user) {
				this.isLoggedIn = true;
				this.user = user;
			} else {
				this.isLoggedIn = false;
				this.user = null;
			}
		} catch (_) {
			this.isLoggedIn = false;
			this.user = null;
		} finally {
			this.isLoading = false;
		}
	},

	async logout() {
		await api().auth.logout();
		this.isLoggedIn = false;
		this.user = null;
	},
});
