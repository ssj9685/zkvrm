import { describe, expect, test } from "bun:test";
import {
	clampFloatingWindowPoint,
	resolveSelectedWindowAutoPosition,
} from "../brain-window";

describe("brain floating window helpers", () => {
	test("clamps a floating window inside shell bounds", () => {
		expect(
			clampFloatingWindowPoint(
				{ x: -48, y: 640 },
				{ width: 240, height: 180 },
				{ width: 920, height: 560, margin: 16 },
			),
		).toEqual({ x: 16, y: 364 });
	});

	test("auto position prefers the right side when anchor is left of threshold", () => {
		expect(
			resolveSelectedWindowAutoPosition({
				anchor: { x: 280, y: 220 },
				size: { width: 248, height: 172 },
				bounds: { width: 980, height: 640, margin: 16 },
			}),
		).toEqual({ x: 300, y: 176 });
	});

	test("auto position flips to the left and clamps inside shell", () => {
		expect(
			resolveSelectedWindowAutoPosition({
				anchor: { x: 860, y: 40 },
				size: { width: 248, height: 172 },
				bounds: { width: 980, height: 640, margin: 16 },
			}),
		).toEqual({ x: 592, y: 16 });
	});
});
