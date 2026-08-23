import type {
	MemoBrainPositionPayload,
	MemoConnectionStylePayload,
	MemoDownloadPayload,
	MemoMetaPayload,
	MemoPinColor,
	MemoQueryOptions,
	MemoYarnColor,
	MemoRecord,
	MemoTag,
	MemoTone,
} from "@server/api/memo-api";
import type { AuthenticatedUser } from "@server/auth/session";

type ApiErrorPayload = {
	code?: string;
	message?: string;
	status?: number;
	name?: string;
};

type RequestOptions = {
	body?: unknown;
	method?: string;
};

type ClientApi = {
	auth: {
		register(payload: { username: string; password: string }): Promise<void>;
		login(payload: {
			username: string;
			password: string;
		}): Promise<AuthenticatedUser>;
		logout(): Promise<void>;
		me(): Promise<AuthenticatedUser | null>;
	};
	memo: {
		list(payload?: MemoQueryOptions): Promise<MemoRecord[]>;
		create(payload: {
			content: string;
			title?: string;
			tone?: MemoTone;
		}): Promise<MemoRecord>;
		update(payload: Pick<MemoRecord, "id" | "content">): Promise<MemoRecord>;
		setMeta(payload: MemoMetaPayload): Promise<MemoRecord>;
		setBrainPosition(payload: MemoBrainPositionPayload): Promise<MemoRecord>;
		remove(payload: Pick<MemoRecord, "id">): Promise<void>;
		listTags(): Promise<MemoTag[]>;
		upsertTag(payload: { id?: number; name: string }): Promise<MemoTag>;
		deleteTag(payload: { id: number }): Promise<void>;
		setMemoTags(payload: {
			memoId: number;
			tagIds: number[];
		}): Promise<MemoRecord>;
		connectMemo(payload: {
			memoAId: number;
			memoBId: number;
			yarnColor?: MemoYarnColor;
		}): Promise<void>;
		setConnectionStyle(payload: MemoConnectionStylePayload): Promise<void>;
		disconnectMemo(payload: {
			memoAId: number;
			memoBId: number;
		}): Promise<void>;
		download(): Promise<MemoDownloadPayload>;
	};
};

function toApiError(response: Response, payload?: ApiErrorPayload | null) {
	const message = payload?.message || response.statusText || "Request failed";
	return Object.assign(new Error(message), {
		code: payload?.code,
		status: payload?.status ?? response.status,
		name: payload?.name ?? "Error",
	});
}

async function throwIfError(response: Response): Promise<void> {
	if (response.ok) {
		return;
	}

	let payload: ApiErrorPayload | null = null;
	const contentType = response.headers.get("Content-Type");
	if (contentType?.includes("application/json")) {
		try {
			payload = (await response.json()) as ApiErrorPayload;
		} catch {
			payload = null;
		}
	} else {
		const text = await response.text();
		if (text.trim()) {
			payload = { message: text, status: response.status };
		}
	}

	throw toApiError(response, payload);
}

function buildRequestInit({
	body,
	method = "GET",
}: RequestOptions): RequestInit {
	const headers = new Headers({
		Accept: "application/json",
	});

	const init: RequestInit = {
		method,
		credentials: "same-origin",
		headers,
	};

	if (body !== undefined) {
		headers.set("Content-Type", "application/json");
		init.body = JSON.stringify(body);
	}

	return init;
}

async function requestJson<T>(path: string, options: RequestOptions = {}) {
	const response = await fetch(path, buildRequestInit(options));
	await throwIfError(response);
	if (response.status === 204) {
		return undefined as T;
	}
	return (await response.json()) as T;
}

async function requestNoContent(path: string, options: RequestOptions = {}) {
	const response = await fetch(path, buildRequestInit(options));
	await throwIfError(response);
}

function parseFilename(disposition: string | null) {
	if (!disposition) {
		return "download";
	}

	const utf8Match = disposition.match(/filename\*=UTF-8''([^;]+)/i);
	if (utf8Match?.[1]) {
		try {
			return decodeURIComponent(utf8Match[1]);
		} catch {
			return utf8Match[1];
		}
	}

	const filenameMatch = disposition.match(/filename="?([^"]+)"?/i);
	return filenameMatch?.[1] ?? "download";
}

async function requestDownload(path: string): Promise<MemoDownloadPayload> {
	const response = await fetch(
		path,
		buildRequestInit({
			method: "GET",
		}),
	);
	await throwIfError(response);
	const buffer = await response.arrayBuffer();
	return {
		filename: parseFilename(response.headers.get("Content-Disposition")),
		contentType:
			response.headers.get("Content-Type") ?? "application/octet-stream",
		data: new Uint8Array(buffer),
	};
}

function createSession(): ClientApi {
	return {
		auth: {
			async register(payload) {
				await requestNoContent("/api/auth/register", {
					method: "POST",
					body: payload,
				});
			},
			async login(payload) {
				return await requestJson<AuthenticatedUser>("/api/auth/login", {
					method: "POST",
					body: payload,
				});
			},
			async logout() {
				await requestNoContent("/api/auth/logout", {
					method: "POST",
				});
			},
			async me() {
				return await requestJson<AuthenticatedUser | null>("/api/auth/me");
			},
		},
		memo: {
			async list(payload) {
				return await requestJson<MemoRecord[]>("/api/memos/list", {
					method: "POST",
					body: payload ?? {},
				});
			},
			async create(payload) {
				return await requestJson<MemoRecord>("/api/memos", {
					method: "POST",
					body: payload,
				});
			},
			async update(payload) {
				return await requestJson<MemoRecord>(
					`/api/memos/${payload.id}/content`,
					{
						method: "PATCH",
						body: {
							content: payload.content,
						},
					},
				);
			},
			async setMeta(payload) {
				return await requestJson<MemoRecord>(`/api/memos/${payload.id}/meta`, {
					method: "PATCH",
					body: {
						title: payload.title,
						tone: payload.tone,
						pin_color: payload.pin_color as MemoPinColor | undefined,
						is_pinned: payload.is_pinned,
						archived_at: payload.archived_at,
					},
				});
			},
			async setBrainPosition(payload) {
				return await requestJson<MemoRecord>(
					`/api/memos/${payload.id}/brain-position`,
					{
						method: "PATCH",
						body: {
							x: payload.x,
							y: payload.y,
						},
					},
				);
			},
			async remove(payload) {
				await requestNoContent(`/api/memos/${payload.id}`, {
					method: "DELETE",
				});
			},
			async listTags() {
				return await requestJson<MemoTag[]>("/api/tags");
			},
			async upsertTag(payload) {
				if (payload.id === undefined) {
					return await requestJson<MemoTag>("/api/tags", {
						method: "POST",
						body: { name: payload.name },
					});
				}

				return await requestJson<MemoTag>(`/api/tags/${payload.id}`, {
					method: "PATCH",
					body: { name: payload.name },
				});
			},
			async deleteTag(payload) {
				await requestNoContent(`/api/tags/${payload.id}`, {
					method: "DELETE",
				});
			},
			async setMemoTags(payload) {
				return await requestJson<MemoRecord>(
					`/api/memos/${payload.memoId}/tags`,
					{
						method: "PUT",
						body: { tagIds: payload.tagIds },
					},
				);
			},
			async connectMemo(payload) {
				await requestNoContent("/api/memos/connect", {
					method: "POST",
					body: payload,
				});
			},
			async setConnectionStyle(payload) {
				await requestNoContent("/api/memos/connection-style", {
					method: "PATCH",
					body: payload,
				});
			},
			async disconnectMemo(payload) {
				await requestNoContent("/api/memos/disconnect", {
					method: "POST",
					body: payload,
				});
			},
			async download() {
				return await requestDownload("/api/memos/download");
			},
		},
	};
}

export const api = () => createSession();
