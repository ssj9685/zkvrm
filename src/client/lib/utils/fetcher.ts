import { Fetcher } from "@ga-ut/fetcher";

export const fetcher = new Fetcher({
	baseHeaders: { "Content-Type": "application/json" },
});
