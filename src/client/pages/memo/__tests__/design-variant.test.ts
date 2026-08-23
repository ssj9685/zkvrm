import { describe, expect, test } from "bun:test";
import {
	brainNodeShape,
	calculateOverlayCoverageRatio,
	getBrainVariantGeometry,
	getBrainVariantStyle,
	getDefaultBrainChromeDensity,
	isOverlayCoverageWithinTarget,
	memoTheme,
} from "../design-variant";

describe("memo design variant helpers", () => {
	test("exports the fixed memo theme contract", () => {
		expect(memoTheme).toBe("signal_cluster");
		expect(brainNodeShape).toBe("sticky");
		expect(getDefaultBrainChromeDensity()).toBe("minimal");
	});

	test("provides deterministic sticky geometry values", () => {
		const geometry = getBrainVariantGeometry("signal_cluster");
		expect(geometry.centerWidthDesktop).toBe(244);
		expect(geometry.connectedHeightDesktop).toBe(146);
		expect(geometry.candidateWidthMobile).toBe(148);
		expect(geometry.baseEdgeWidth).toBe(3.8);
		expect(geometry.highlightEdgeWidth).toBe(5.6);
	});

	test("exposes signal cluster style tokens", () => {
		const style = getBrainVariantStyle("signal_cluster");
		expect(style.edge.curveBend).toBe(0.19);
		expect(style.layout.connectedOrbitX).toBe(0.29);
		expect(style.layout.candidateOrbitY).toBe(0.32);
		expect(style.motion.settleDurationMs).toBe(360);
	});

	test("overlay coverage ratio remains within 16 percent when design target is met", () => {
		const ratio = calculateOverlayCoverageRatio({
			shellHeight: 700,
			topOverlayHeight: 58,
			bottomOverlayHeight: 48,
		});
		expect(ratio).toBeLessThanOrEqual(0.16);
		expect(
			isOverlayCoverageWithinTarget({
				shellHeight: 700,
				topOverlayHeight: 58,
				bottomOverlayHeight: 48,
			}),
		).toBe(true);
		expect(
			isOverlayCoverageWithinTarget({
				shellHeight: 700,
				topOverlayHeight: 84,
				bottomOverlayHeight: 58,
			}),
		).toBe(false);
	});
});
