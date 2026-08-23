import { describe, expect, test } from "bun:test";
import { hasMemoHit } from "../brain-hit";

describe("brain hit helpers", () => {
test("returns false for undefined or null-like hits", () => {
	expect(hasMemoHit(undefined)).toBe(false);
	expect(hasMemoHit(null)).toBe(false);
	expect(hasMemoHit({ memoId: null })).toBe(false);
	expect(hasMemoHit({ memoId: undefined as unknown as number })).toBe(false);
	expect(hasMemoHit({ memoId: Number.NaN })).toBe(false);
});

	test("returns true only for numeric memo hits", () => {
		expect(hasMemoHit({ memoId: 1 })).toBe(true);
		expect(hasMemoHit({ memoId: 999 })).toBe(true);
	});
});
