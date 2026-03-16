export type BrainNodeHit = {
	memoId: number | null;
};

export function hasMemoHit(
	nodeHit: BrainNodeHit | null | undefined,
): nodeHit is BrainNodeHit & { memoId: number } {
	return Boolean(
		nodeHit &&
			typeof nodeHit.memoId === "number" &&
			Number.isFinite(nodeHit.memoId),
	);
}
