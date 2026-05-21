import type { RootApi } from "@server/api/root-api";

function createSession() {
	return {
		auth: {
			register: (payload: Parameters<RootApi["auth"]["register"]>[0]) =>
				callApi("auth", "register", payload),
			login: (payload: Parameters<RootApi["auth"]["login"]>[0]) =>
				callApi("auth", "login", payload),
			logout: () => callApi("auth", "logout"),
			me: () => callApi("auth", "me"),
		},
		memo: {
			list: (payload?: Parameters<RootApi["memo"]["list"]>[0]) =>
				callApi("memo", "list", payload),
			create: (payload: Parameters<RootApi["memo"]["create"]>[0]) =>
				callApi("memo", "create", payload),
			update: (payload: Parameters<RootApi["memo"]["update"]>[0]) =>
				callApi("memo", "update", payload),
			remove: (payload: Parameters<RootApi["memo"]["remove"]>[0]) =>
				callApi("memo", "remove", payload),
			download: () => callApi("memo", "download"),
		},
	} as RootApi;
}

async function callApi(resource: string, method: string, payload = {}) {
	const response = await fetch(`/api/${resource}/${method}`, {
		method: "POST",
		credentials: "same-origin",
		headers: {
			"Content-Type": "application/json",
		},
		body: JSON.stringify(payload),
	});
	const data = await response.json();
	if (!response.ok || !data.ok) {
		const error = new Error(data.error?.message ?? "Request failed");
		Object.assign(error, data.error);
		throw error;
	}
	return reviveApiResult(data.result);
}

function reviveApiResult(result: unknown) {
	if (
		result &&
		typeof result === "object" &&
		"data" in result &&
		Array.isArray(result.data) &&
		result.data.every((value) => Number.isInteger(value))
	) {
		return {
			...result,
			data: new Uint8Array(result.data),
		};
	}
	return result;
}

export const api = () => createSession();
