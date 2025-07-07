class BaseError extends Error {
	url: string;
	statusCode: number;

	constructor({ url, statusCode }: { url: string; statusCode: number }) {
		super();
		this.url = url;
		this.statusCode = statusCode;
	}
}

type Method = "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
type Options = Omit<RequestInit, "method" | "body">;
type ActionParams = Options & { method: Method; body?: object };
type InterceptorHandler<T extends Request | Response> = (
	param: T,
) => T | Promise<T>;
type BaseHeaders = { [key: string]: string };

export class Fetcher {
	private requestInterceptors: InterceptorHandler<Request>[] = [];
	private responseInterceptors: InterceptorHandler<Response>[] = [];
	private baseUrl: string = "";
	private baseHeaders: BaseHeaders = {};
	private baseOptions: Options = {};

	constructor(options?: {
		baseUrl?: string;
		baseHeaders?: BaseHeaders;
		baseOptions?: Options;
	}) {
		const { baseUrl, baseHeaders, baseOptions } = options ?? {};

		if (baseUrl) {
			this.baseUrl = baseUrl;
		}

		if (baseHeaders) {
			this.baseHeaders = baseHeaders;
		}

		if (baseOptions) {
			this.baseOptions = baseOptions;
		}
	}

	addRequestInterceptor(handler: InterceptorHandler<Request>) {
		this.requestInterceptors.push(handler);
	}

	addResponseInterceptor(handler: InterceptorHandler<Response>) {
		this.responseInterceptors.push(handler);
	}

	get<T>(url: string, options?: Options) {
		return this.action<T>(url, {
			method: "GET",
			...options,
		});
	}

	post<T>(url: string, data: object, options?: Options) {
		return this.action<T>(url, {
			method: "POST",
			body: data,
			...options,
		});
	}

	patch<T>(url: string, data: object, options?: Options) {
		return this.action<T>(url, {
			method: "PATCH",
			body: data,
			...options,
		});
	}

	put<T>(url: string, data: object, options?: Options) {
		return this.action<T>(url, {
			method: "PUT",
			body: data,
			...options,
		});
	}

	delete<T>(url: string, options?: Options) {
		return this.action<T>(url, {
			method: "DELETE",
			...options,
		});
	}

	private async action<T>(url: string, params: ActionParams): Promise<T> {
		const { body, method, ...rest } = params;
		const isFormData =
			typeof FormData !== "undefined" && body instanceof FormData;

		const headers = {
			...this.baseHeaders,
			...rest.headers,
		} as Record<string, string>;

		const options = {
			...this.baseOptions,
			...rest,
		};

		if (isFormData) {
			delete headers["Content-Type"];
		}

		const normalizedUrl = this.normalizeUrl(`${this.baseUrl}${url}`);
		const rawRequest = new Request(normalizedUrl, {
			...options,
			method,
			headers,
			body:
				headers["Content-Type"] === "application/json"
					? JSON.stringify(body)
					: (body as BodyInit),
		});

		const request = await this.requestHandler(rawRequest);

		const response = await this.responseHandler(fetch(request));

		if (!response.ok) {
			const statusCode = response.status;
			throw new BaseError({
				url,
				statusCode,
			});
		}

		const disposition = response.headers.get("Content-Disposition");
		const contentType = response.headers.get("Content-Type");

		if (disposition?.includes("attachment"))
			return (await response.blob()) as T;
		if (contentType?.includes("text/")) return (await response.text()) as T;
		if (
			contentType?.includes("image/") ||
			contentType?.includes("audio/") ||
			contentType?.includes("video/") ||
			contentType?.includes("application/vnd") ||
			contentType === "application/octet-stream" ||
			contentType === "application/zip"
		)
			return (await response.blob()) as T;

		return (await response.json()) as T;
	}

	private async requestHandler(request: Request): Promise<Request> {
		let result = request;

		for (const interceptor of this.requestInterceptors) {
			result = await interceptor(result);
		}

		return result;
	}

	private async responseHandler(responsePromise: Promise<Response>) {
		let res: Response;

		try {
			res = await responsePromise;
		} catch (error) {
			const err = error as BaseError;
			res = new Response(JSON.stringify(err), {
				status: err.statusCode,
				headers: {
					"x-origin-url": err.url,
				},
			});
		}

		const newRes = new Response(await res.clone().blob(), {
			status: res.status,
			headers: {
				...Object.fromEntries(res.headers.entries()),
				"x-origin-url": res.url,
			},
		});

		let result = newRes;
		for (const interceptor of this.responseInterceptors) {
			result = await interceptor(result);
		}

		return result;
	}

	private normalizeUrl(url: string) {
		const result = url.trim();

		if (result.startsWith("http") || result.startsWith("https")) {
			return result;
		}

		if (result[0] !== "/") {
			return `/${result}`;
		}

		return result;
	}
}

export const fetcher = new Fetcher({
	baseHeaders: { "Content-Type": "application/json" },
});
