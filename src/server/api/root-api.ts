import { AuthApi } from "./auth-api";
import type { ApiContext } from "./context";
import { MemoApi } from "./memo-api";

export class RootApi {
	#context: ApiContext;
	#auth?: AuthApi;
	#memo?: MemoApi;

	constructor(context: ApiContext) {
		this.#context = context;
	}

	get auth() {
		if (!this.#auth) {
			this.#auth = new AuthApi(this.#context);
		}
		return this.#auth;
	}

	get memo() {
		if (!this.#memo) {
			this.#memo = new MemoApi(this.#context);
		}
		return this.#memo;
	}
}
