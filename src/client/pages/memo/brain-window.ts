export type FloatingWindowPoint = {
	x: number;
	y: number;
};

export type FloatingWindowSize = {
	width: number;
	height: number;
};

export type FloatingWindowBounds = {
	width: number;
	height: number;
	margin: number;
};

export function clampFloatingWindowPoint(
	point: FloatingWindowPoint,
	size: FloatingWindowSize,
	bounds: FloatingWindowBounds,
): FloatingWindowPoint {
	const maxX = Math.max(
		bounds.margin,
		bounds.width - size.width - bounds.margin,
	);
	const maxY = Math.max(
		bounds.margin,
		bounds.height - size.height - bounds.margin,
	);

	return {
		x: Math.min(maxX, Math.max(bounds.margin, point.x)),
		y: Math.min(maxY, Math.max(bounds.margin, point.y)),
	};
}

export function resolveSelectedWindowAutoPosition({
	anchor,
	size,
	bounds,
	offsetX = 20,
	offsetY = 44,
	sideThreshold = 0.62,
}: {
	anchor: FloatingWindowPoint;
	size: FloatingWindowSize;
	bounds: FloatingWindowBounds;
	offsetX?: number;
	offsetY?: number;
	sideThreshold?: number;
}): FloatingWindowPoint {
	const preferLeft = anchor.x > bounds.width * sideThreshold;
	const nextPoint = {
		x: preferLeft ? anchor.x - size.width - offsetX : anchor.x + offsetX,
		y: anchor.y - offsetY,
	};

	return clampFloatingWindowPoint(nextPoint, size, bounds);
}
