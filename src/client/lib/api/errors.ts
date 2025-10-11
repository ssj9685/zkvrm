export const ApiErrorCode = {
	AUTH_INVALID_CREDENTIALS: "AUTH_INVALID_CREDENTIALS",
	AUTH_USERNAME_TAKEN: "AUTH_USERNAME_TAKEN",
	AUTH_UNAUTHORIZED: "AUTH_UNAUTHORIZED",
	VALIDATION_ERROR: "VALIDATION_ERROR",
} as const;

export type ApiErrorCode = (typeof ApiErrorCode)[keyof typeof ApiErrorCode];

export type ApiErrorLike = Error & {
	code?: string;
	status?: number;
};

const messageCodeMap: Record<string, ApiErrorCode> = {
	"Invalid username or password": ApiErrorCode.AUTH_INVALID_CREDENTIALS,
	"Username already taken": ApiErrorCode.AUTH_USERNAME_TAKEN,
	Unauthorized: ApiErrorCode.AUTH_UNAUTHORIZED,
};

type NormalizedApiError = {
	code: ApiErrorCode;
	message: string;
	status?: number;
};

function parsePayload(raw: string | undefined | null) {
	if (!raw) return null;
	try {
		return JSON.parse(raw) as {
			code?: string;
			message?: string;
			status?: number;
		};
	} catch (_error) {
		return null;
	}
}

export function getApiError(error: unknown): NormalizedApiError | null {
	if (!error) return null;

	if (typeof error === "object") {
		const candidate = error as Partial<ApiErrorLike> & {
			message?: string;
			status?: number;
		};

		const payload = parsePayload(candidate.message);
		if (payload?.code && payload?.message) {
			return {
				code: payload.code as ApiErrorCode,
				message: payload.message,
				status: payload.status,
			};
		}

		if (typeof candidate.code === "string" && candidate.message) {
			return {
				code: candidate.code as ApiErrorCode,
				message: candidate.message,
				status: candidate.status,
			};
		}

		if (candidate.message && messageCodeMap[candidate.message]) {
			return {
				code: messageCodeMap[candidate.message],
				message: candidate.message,
				status: candidate.status,
			};
		}
	}

	if (typeof error === "string" && messageCodeMap[error]) {
		return { code: messageCodeMap[error], message: error };
	}

	return null;
}

export function isApiError(error: unknown): error is ApiErrorLike & {
	code: ApiErrorCode;
} {
	return getApiError(error) !== null;
}
