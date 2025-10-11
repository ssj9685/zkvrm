export class ApiContext {
	constructor(public readonly request: Request) {}

	#cookies: string[] = [];

	addCookie(cookie: string) {
		this.#cookies.push(cookie);
	}

	getCookie(name: string) {
		const header = this.request.headers.get("Cookie");
		if (!header) return null;
		for (const part of header.split(";")) {
			const [rawName, ...rest] = part.trim().split("=");
			if (rawName === name) {
				return rest.length > 0 ? decodeURIComponent(rest.join("=")) : "";
			}
		}
		return null;
	}

	applyCookies(response: Response) {
		for (const cookie of this.#cookies) {
			response.headers.append("Set-Cookie", cookie);
		}
		return response;
	}
}
