import { Fetcher } from "@ga-ut/fetcher";

export const fetcher = new Fetcher({
	baseHeaders: { "Content-Type": "application/json" },
	baseOptions: { credentials: "include" },
});

// Ensure GET requests don't send a Content-Type header
fetcher.addRequestInterceptor(async (req) => {
	if (req.method === "GET") {
		const headers = new Headers(req.headers);
		headers.delete("Content-Type");
		return new Request(req, { headers });
	}
	return req;
});
