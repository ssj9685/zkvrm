import { describe, expect, test } from "bun:test";
import { normalizeMemoQuery } from "@shared/memo-query";

describe("normalizeMemoQuery", () => {
	test("returns undefined for nullish values", () => {
		expect(normalizeMemoQuery()).toBeUndefined();
		expect(normalizeMemoQuery(null)).toBeUndefined();
	});

	test("returns undefined for empty or whitespace-only query", () => {
		expect(normalizeMemoQuery("")).toBeUndefined();
		expect(normalizeMemoQuery("   ")).toBeUndefined();
		expect(normalizeMemoQuery("\n\t")).toBeUndefined();
	});

	test("trims and preserves meaningful query", () => {
		expect(normalizeMemoQuery("  hello ")).toBe("hello");
		expect(normalizeMemoQuery("memo 123")).toBe("memo 123");
	});
});
