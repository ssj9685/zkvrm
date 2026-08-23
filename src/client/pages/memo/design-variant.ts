import type { MemoTone } from "@server/api/memo-api";

export type MemoDesignVariant = "signal_cluster";
export type BrainChromeDensity = "minimal" | "compact";

export type BrainVariantGeometry = {
	centerWidthDesktop: number;
	centerWidthMobile: number;
	centerHeightDesktop: number;
	centerHeightMobile: number;
	connectedWidthDesktop: number;
	connectedWidthMobile: number;
	connectedHeightDesktop: number;
	connectedHeightMobile: number;
	candidateWidthDesktop: number;
	candidateWidthMobile: number;
	candidateHeightDesktop: number;
	candidateHeightMobile: number;
	overflowWidthDesktop: number;
	overflowWidthMobile: number;
	overflowHeightDesktop: number;
	overflowHeightMobile: number;
	centerRadius: number;
	connectedRadius: number;
	candidateRadius: number;
	overflowRadius: number;
	labelMaxCenter: number;
	labelMaxNode: number;
	baseEdgeWidth: number;
	highlightEdgeWidth: number;
};

type BrainNodeSurfaceStyle = {
	fillA: string;
	fillB: string;
	stroke: string;
	text: string;
	meta: string;
	halo: string;
	shadow: string;
	sheen: string;
};

type StickyPaperPalette = {
	paperA: string;
	paperB: string;
	fold: string;
	line: string;
	shadow: string;
	text: string;
	mutedText: string;
};

type StickyAccentPalette = {
	head: string;
	rim: string;
	shadow: string;
};

type StickyYarnPalette = {
	base: string;
	shadow: string;
	highlight: string;
};

export type BrainVariantStyle = {
	background: {
		baseA: string;
		baseB: string;
		baseC: string;
		nebulaA: string;
		nebulaB: string;
		nebulaC: string;
		grid: string;
		vignette: string;
	};
	edge: {
		base: string;
		strong: string;
		ghost: string;
		glow: string;
		curveBend: number;
		filamentOffset: number;
		filamentAlpha: number;
	};
	node: {
		center: BrainNodeSurfaceStyle;
		connected: BrainNodeSurfaceStyle;
		candidate: BrainNodeSurfaceStyle;
		overflow: BrainNodeSurfaceStyle;
		selected: {
			stroke: string;
			halo: string;
			shadow: string;
		};
		focusNeighbor: {
			stroke: string;
			halo: string;
			shadow: string;
		};
	};
	chrome: {
		overlaySurface: string;
		overlayBorder: string;
		overlayShadow: string;
		panelSurface: string;
		pillSurface: string;
		textPrimary: string;
		textMuted: string;
		activeSurface: string;
		activeText: string;
	};
	layout: {
		centerXRatioDesktop: number;
		centerXRatioMobile: number;
		centerYRatioDesktop: number;
		centerYRatioMobile: number;
		connectedOrbitX: number;
		connectedOrbitY: number;
		candidateOrbitX: number;
		candidateOrbitY: number;
		organicDriftX: number;
		organicDriftY: number;
	};
	motion: {
		settleDurationMs: number;
		settleScaleFrom: number;
		pulseGlowBlur: number;
	};
	cork: {
		boardA: string;
		boardB: string;
		fleckLight: string;
		fleckDark: string;
		frame: string;
	};
	palette: {
		notes: Record<MemoTone, StickyPaperPalette>;
		pins: Record<MemoTone, StickyAccentPalette>;
		yarns: Record<MemoTone, StickyYarnPalette>;
	};
};

export const memoTheme: MemoDesignVariant = "signal_cluster";
export const brainNodeShape = "sticky";

const signalClusterGeometry: BrainVariantGeometry = {
	centerWidthDesktop: 252,
	centerWidthMobile: 180,
	centerHeightDesktop: 196,
	centerHeightMobile: 140,
	connectedWidthDesktop: 204,
	connectedWidthMobile: 148,
	connectedHeightDesktop: 152,
	connectedHeightMobile: 108,
	candidateWidthDesktop: 170,
	candidateWidthMobile: 124,
	candidateHeightDesktop: 130,
	candidateHeightMobile: 92,
	overflowWidthDesktop: 116,
	overflowWidthMobile: 84,
	overflowHeightDesktop: 54,
	overflowHeightMobile: 40,
	centerRadius: 6,
	connectedRadius: 5,
	candidateRadius: 4,
	overflowRadius: 20,
	labelMaxCenter: 26,
	labelMaxNode: 22,
	baseEdgeWidth: 3.2,
	highlightEdgeWidth: 4.8,
};

const signalClusterStyle: BrainVariantStyle = {
	background: {
		baseA: "#c8a06a",
		baseB: "#b58a52",
		baseC: "#8f6635",
		nebulaA: "rgba(255, 238, 200, 0.18)",
		nebulaB: "rgba(108, 64, 28, 0.1)",
		nebulaC: "rgba(72, 40, 16, 0.13)",
		grid: "rgba(80, 50, 24, 0.045)",
		vignette: "rgba(60, 36, 14, 0.38)",
	},
	edge: {
		base: "#7a4e28",
		strong: "#4e2e14",
		ghost: "rgba(72, 44, 18, 0.18)",
		glow: "rgba(255, 235, 195, 0.2)",
		curveBend: 0.16,
		filamentOffset: 7,
		filamentAlpha: 0.2,
	},
	node: {
		center: {
			fillA: "#fffaee",
			fillB: "#f8e89a",
			stroke: "#7a5424",
			text: "#3e2b12",
			meta: "rgba(62, 43, 18, 0.72)",
			halo: "rgba(255, 248, 210, 0.3)",
			shadow: "rgba(90, 60, 20, 0.32)",
			sheen: "rgba(255, 255, 255, 0.52)",
		},
		connected: {
			fillA: "#fffbf2",
			fillB: "#f2e07c",
			stroke: "#8a6030",
			text: "#3e2e18",
			meta: "rgba(62, 46, 24, 0.62)",
			halo: "rgba(255, 245, 200, 0.22)",
			shadow: "rgba(85, 58, 22, 0.22)",
			sheen: "rgba(255, 255, 255, 0.38)",
		},
		candidate: {
			fillA: "#fffef8",
			fillB: "#f6edbe",
			stroke: "#9c7440",
			text: "#4a3820",
			meta: "rgba(74, 56, 32, 0.58)",
			halo: "rgba(255, 248, 215, 0.16)",
			shadow: "rgba(80, 56, 24, 0.16)",
			sheen: "rgba(255, 255, 255, 0.28)",
		},
		overflow: {
			fillA: "#f8f1de",
			fillB: "#e8d494",
			stroke: "#906a38",
			text: "#4c3a20",
			meta: "rgba(76, 58, 32, 0.58)",
			halo: "rgba(255, 240, 190, 0.16)",
			shadow: "rgba(88, 62, 28, 0.16)",
			sheen: "rgba(255, 255, 255, 0.22)",
		},
		selected: {
			stroke: "#4a2e0e",
			halo: "rgba(255, 254, 240, 0.44)",
			shadow: "rgba(60, 36, 10, 0.38)",
		},
		focusNeighbor: {
			stroke: "#6a4824",
			halo: "rgba(255, 246, 218, 0.28)",
			shadow: "rgba(78, 52, 20, 0.26)",
		},
	},
	chrome: {
		overlaySurface: "rgba(255, 250, 240, 0.92)",
		overlayBorder: "rgba(120, 82, 44, 0.22)",
		overlayShadow: "0 24px 44px -28px rgba(60, 36, 10, 0.4)",
		panelSurface: "rgba(255, 251, 243, 0.96)",
		pillSurface: "rgba(248, 236, 208, 0.97)",
		textPrimary: "#342010",
		textMuted: "rgba(72, 50, 24, 0.72)",
		activeSurface: "#5e3812",
		activeText: "#fff9ef",
	},
	layout: {
		centerXRatioDesktop: 0.5,
		centerXRatioMobile: 0.5,
		centerYRatioDesktop: 0.52,
		centerYRatioMobile: 0.52,
		connectedOrbitX: 0.29,
		connectedOrbitY: 0.23,
		candidateOrbitX: 0.42,
		candidateOrbitY: 0.32,
		organicDriftX: 0.034,
		organicDriftY: 0.048,
	},
	motion: {
		settleDurationMs: 400,
		settleScaleFrom: 0.968,
		pulseGlowBlur: 16,
	},
	cork: {
		boardA: "#c29060",
		boardB: "#a07040",
		fleckLight: "rgba(255, 228, 180, 0.24)",
		fleckDark: "rgba(90, 52, 18, 0.16)",
		frame: "#5e3a18",
	},
	palette: {
		notes: {
			neutral: {
				paperA: "#f8f3e6",
				paperB: "#e9ddc8",
				fold: "#d4bea0",
				line: "#72604a",
				shadow: "rgba(72, 52, 28, 0.22)",
				text: "#302414",
				mutedText: "#60503c",
			},
			sun: {
				paperA: "#fff9d0",
				paperB: "#fae45a",
				fold: "#d9c030",
				line: "#6e4e0e",
				shadow: "rgba(100, 68, 10, 0.22)",
				text: "#3c2806",
				mutedText: "#6a5222",
			},
			peach: {
				paperA: "#fff0e8",
				paperB: "#f4b89c",
				fold: "#d89278",
				line: "#6e3828",
				shadow: "rgba(110, 56, 38, 0.22)",
				text: "#3e1e14",
				mutedText: "#6a4038",
			},
			violet: {
				paperA: "#f2eeff",
				paperB: "#cfc0f0",
				fold: "#b8a4de",
				line: "#4e3e6e",
				shadow: "rgba(78, 62, 110, 0.22)",
				text: "#2a2040",
				mutedText: "#524870",
			},
			aqua: {
				paperA: "#e8f8f6",
				paperB: "#9ed8d2",
				fold: "#7ec0ba",
				line: "#205650",
				shadow: "rgba(32, 86, 80, 0.22)",
				text: "#143630",
				mutedText: "#3e6462",
			},
			lime: {
				paperA: "#f0fada",
				paperB: "#c6df88",
				fold: "#aac660",
				line: "#486022",
				shadow: "rgba(72, 96, 34, 0.22)",
				text: "#283814",
				mutedText: "#506038",
			},
		},
		pins: {
			neutral: {
				head: "#8a9aac",
				rim: "#e8edf4",
				shadow: "rgba(42, 52, 68, 0.4)",
			},
			sun: {
				head: "#c8820e",
				rim: "#fce8b0",
				shadow: "rgba(110, 64, 4, 0.42)",
			},
			peach: {
				head: "#c4604a",
				rim: "#ffd8c6",
				shadow: "rgba(96, 36, 22, 0.42)",
			},
			violet: {
				head: "#7258b0",
				rim: "#e4dcfc",
				shadow: "rgba(50, 34, 92, 0.42)",
			},
			aqua: {
				head: "#228880",
				rim: "#d8f4f0",
				shadow: "rgba(14, 64, 60, 0.42)",
			},
			lime: {
				head: "#6e9428",
				rim: "#ecf8cc",
				shadow: "rgba(54, 66, 16, 0.42)",
			},
		},
		yarns: {
			neutral: {
				base: "#7e8e9e",
				shadow: "#404c5a",
				highlight: "#dce4ee",
			},
			sun: {
				base: "#c88a1c",
				shadow: "#7a4e08",
				highlight: "#ffedba",
			},
			peach: {
				base: "#c06858",
				shadow: "#7e3828",
				highlight: "#ffdace",
			},
			violet: {
				base: "#8066b8",
				shadow: "#4e3c80",
				highlight: "#e8e0ff",
			},
			aqua: {
				base: "#3e9e9a",
				shadow: "#1e6462",
				highlight: "#d0f8f4",
			},
			lime: {
				base: "#88a040",
				shadow: "#4e6018",
				highlight: "#eef8cc",
			},
		},
	},
};

export function getBrainVariantGeometry(
	_variant: MemoDesignVariant = memoTheme,
): BrainVariantGeometry {
	return signalClusterGeometry;
}

export function getBrainVariantStyle(
	_variant: MemoDesignVariant = memoTheme,
): BrainVariantStyle {
	return signalClusterStyle;
}

export function getDefaultBrainChromeDensity(): BrainChromeDensity {
	return "minimal";
}

export function calculateOverlayCoverageRatio({
	shellHeight,
	topOverlayHeight,
	bottomOverlayHeight,
}: {
	shellHeight: number;
	topOverlayHeight: number;
	bottomOverlayHeight: number;
}) {
	if (shellHeight <= 0) {
		return 1;
	}
	const occupied =
		Math.max(0, topOverlayHeight) + Math.max(0, bottomOverlayHeight);
	return occupied / shellHeight;
}

export function isOverlayCoverageWithinTarget({
	shellHeight,
	topOverlayHeight,
	bottomOverlayHeight,
	targetRatio = 0.16,
}: {
	shellHeight: number;
	topOverlayHeight: number;
	bottomOverlayHeight: number;
	targetRatio?: number;
}) {
	return (
		calculateOverlayCoverageRatio({
			shellHeight,
			topOverlayHeight,
			bottomOverlayHeight,
		}) <= targetRatio
	);
}
