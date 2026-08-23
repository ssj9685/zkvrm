import type {
	MemoPinColor,
	MemoRecord,
	MemoTone,
	MemoYarnColor,
} from "@server/api/memo-api";
import {
	type BrainVariantGeometry,
	getBrainVariantGeometry,
	getBrainVariantStyle,
	type MemoDesignVariant,
} from "./design-variant";

export type BrainNodeKind = "center" | "connected" | "candidate" | "overflow";
export type BrainNodeId = number | string;
export type BrainNodeShapeKind = "sticky" | "token";

export type BrainNode = {
	id: BrainNodeId;
	title: string;
	contentPreview: string;
	kind: BrainNodeKind;
	memoId: number | null;
	connectedCount: number;
	tone: MemoTone;
	pinColor: MemoPinColor;
	brainPosition: BrainStoredPosition | null;
};

export type BrainEdge = {
	id: string;
	fromId: BrainNodeId;
	toId: BrainNodeId;
	connected: boolean;
	memoAId: number;
	memoBId: number;
	yarnColor: MemoYarnColor;
};

export type BrainGraphProjection = {
	nodes: BrainNode[];
	edges: BrainEdge[];
	overflowCount: number;
	nodeMeta: Map<number, BrainNodeMeta>;
	centerMetrics: BrainCenterMetrics;
};

export type BrainRecencyBucket = "today" | "week" | "older";

export type BrainNodeMeta = {
	sharedTagCount: number;
	recencyBucket: BrainRecencyBucket;
};

export type BrainCenterMetrics = {
	connectedVisibleCount: number;
	candidateVisibleCount: number;
};

export type BrainStoredPosition = {
	x: number;
	y: number;
};

type ProjectBrainGraphInput = {
	centerMemo: MemoRecord | null;
	memos: MemoRecord[];
	nodeLimit: number;
	searchQuery?: string;
};

type LayoutInput = {
	nodes: BrainNode[];
	width: number;
	height: number;
	variant?: MemoDesignVariant;
	positionOverrides?: ReadonlyMap<number, BrainStoredPosition | null>;
};

export type BrainNodeLayout = {
	x: number;
	y: number;
	width: number;
	height: number;
	borderRadius: number;
	radius: number;
	shape: BrainNodeShapeKind;
};

const MIN_NODE_LIMIT = 6;

const CONNECTED_CLUSTER_OFFSETS = [
	{ x: -0.36, y: -0.74 },
	{ x: 0.44, y: -0.58 },
	{ x: 0.76, y: -0.14 },
	{ x: -0.62, y: 0.04 },
	{ x: 0.18, y: 0.62 },
	{ x: -0.08, y: 0.92 },
	{ x: 0.94, y: 0.32 },
	{ x: -0.88, y: -0.28 },
	{ x: 0.12, y: -1.02 },
	{ x: -0.94, y: 0.48 },
	{ x: 1.02, y: -0.4 },
	{ x: 0.62, y: 0.88 },
];

const CANDIDATE_CLUSTER_OFFSETS = [
	{ x: -0.84, y: -0.96 },
	{ x: 0.94, y: -0.86 },
	{ x: 1.12, y: 0.08 },
	{ x: -1.06, y: 0.24 },
	{ x: 0.58, y: 1.06 },
	{ x: -0.14, y: 1.16 },
	{ x: 0.04, y: -1.22 },
	{ x: -0.66, y: 0.98 },
	{ x: 1.06, y: -0.3 },
	{ x: -1.14, y: -0.3 },
	{ x: 0.86, y: 0.74 },
	{ x: -0.92, y: 0.76 },
];

const OVERFLOW_OFFSET = { x: 1.16, y: 1.08 };

function normalizeQuery(value: string | undefined) {
	return value?.trim().toLowerCase() ?? "";
}

function sortByUpdatedDescAndId(left: MemoRecord, right: MemoRecord): number {
	if (right.updated_at !== left.updated_at) {
		return right.updated_at - left.updated_at;
	}
	return left.id - right.id;
}

function countSharedTags(centerMemo: MemoRecord, candidateMemo: MemoRecord) {
	if (centerMemo.tags.length === 0 || candidateMemo.tags.length === 0) {
		return 0;
	}
	const centerTagIds = new Set(centerMemo.tags.map((tag) => tag.id));
	let count = 0;
	for (const tag of candidateMemo.tags) {
		if (centerTagIds.has(tag.id)) {
			count += 1;
		}
	}
	return count;
}

function resolveRecencyBucket(
	updatedAt: number,
	now: number,
): BrainRecencyBucket {
	const elapsed = Math.max(0, now - updatedAt);
	if (elapsed <= 24 * 60 * 60 * 1000) {
		return "today";
	}
	if (elapsed <= 7 * 24 * 60 * 60 * 1000) {
		return "week";
	}
	return "older";
}

function buildConnectedEdges(
	centerMemo: MemoRecord,
	nodes: BrainNode[],
): BrainEdge[] {
	const connectedIdSet = new Set<number>(centerMemo.connected_ids);
	const yarnColorByMemoId = new Map(
		(centerMemo.connections ?? []).map((connection) => [
			connection.memo_id,
			connection.yarn_color,
		]),
	);
	return nodes
		.filter(
			(node) =>
				node.memoId !== null &&
				node.memoId !== centerMemo.id &&
				connectedIdSet.has(node.memoId),
		)
		.map((node) => {
			const memoId = node.memoId as number;
			const memoAId = Math.min(centerMemo.id, memoId);
			const memoBId = Math.max(centerMemo.id, memoId);
			return {
				id: `${memoAId}-${memoBId}`,
				fromId: centerMemo.id,
				toId: memoId,
				connected: true,
				memoAId,
				memoBId,
				yarnColor: yarnColorByMemoId.get(memoId) ?? "neutral",
			};
		});
}

function buildContentPreview(content: string) {
	const normalized = content.replace(/\s+/g, " ").trim();
	if (!normalized) {
			return "내용을 더해보세요";
	}
	return normalized.slice(0, 72);
}

export function projectBrainGraph({
	centerMemo,
	memos,
	nodeLimit,
	searchQuery,
}: ProjectBrainGraphInput): BrainGraphProjection {
	if (!centerMemo) {
		return {
			nodes: [],
			edges: [],
			overflowCount: 0,
			nodeMeta: new Map<number, BrainNodeMeta>(),
			centerMetrics: {
				connectedVisibleCount: 0,
				candidateVisibleCount: 0,
			},
		};
	}

	const normalizedLimit = Math.max(MIN_NODE_LIMIT, nodeLimit);
	const now = Date.now();
	const memoById = new Map<number, MemoRecord>();
	for (const memo of memos) {
		memoById.set(memo.id, memo);
	}

	const connectedMemos = centerMemo.connected_ids
		.map((id) => memoById.get(id))
		.filter((memo): memo is MemoRecord => Boolean(memo))
		.sort(sortByUpdatedDescAndId);

	const usedIds = new Set<number>([centerMemo.id]);
	for (const memo of connectedMemos) {
		usedIds.add(memo.id);
	}

	const candidateQuery = normalizeQuery(searchQuery);
	const candidatePool = memos
		.filter((memo) => !usedIds.has(memo.id))
		.filter((memo) => {
			if (!candidateQuery) {
				return true;
			}
			return (
				memo.title.toLowerCase().includes(candidateQuery) ||
				memo.content.toLowerCase().includes(candidateQuery)
			);
		})
		.sort((left, right) => {
			const sharedTagsDiff =
				countSharedTags(centerMemo, right) - countSharedTags(centerMemo, left);
			if (sharedTagsDiff !== 0) {
				return sharedTagsDiff;
			}
			return sortByUpdatedDescAndId(left, right);
		});

	const capacity = normalizedLimit - 1;
	const connectedShown = connectedMemos.slice(0, capacity);
	const remaining = Math.max(0, capacity - connectedShown.length);
	const candidateShown = candidatePool.slice(0, remaining);
	const overflowCount =
		Math.max(0, connectedMemos.length - connectedShown.length) +
		Math.max(0, candidatePool.length - candidateShown.length);

	const nodes: BrainNode[] = [
		{
			id: centerMemo.id,
			title: centerMemo.title,
			contentPreview: buildContentPreview(centerMemo.content),
			kind: "center",
			memoId: centerMemo.id,
			connectedCount: centerMemo.connected_ids.length,
			tone: centerMemo.tone,
			pinColor: centerMemo.pin_color,
			brainPosition: resolveBrainPosition(centerMemo),
		},
		...connectedShown.map((memo) => ({
			id: memo.id,
			title: memo.title,
			contentPreview: buildContentPreview(memo.content),
			kind: "connected" as const,
			memoId: memo.id,
			connectedCount: memo.connected_ids.length,
			tone: memo.tone,
			pinColor: memo.pin_color,
			brainPosition: resolveBrainPosition(memo),
		})),
		...candidateShown.map((memo) => ({
			id: memo.id,
			title: memo.title,
			contentPreview: buildContentPreview(memo.content),
			kind: "candidate" as const,
			memoId: memo.id,
			connectedCount: memo.connected_ids.length,
			tone: memo.tone,
			pinColor: memo.pin_color,
			brainPosition: resolveBrainPosition(memo),
		})),
	];

	if (overflowCount > 0) {
		nodes.push({
			id: "overflow",
			title: `+${overflowCount} more`,
			contentPreview: "More notes",
			kind: "overflow",
			memoId: null,
			connectedCount: 0,
			tone: "neutral",
			pinColor: "neutral",
			brainPosition: null,
		});
	}

	const nodeMeta = new Map<number, BrainNodeMeta>();
	for (const node of nodes) {
		if (node.memoId === null) {
			continue;
		}
		const memo = memoById.get(node.memoId) ?? centerMemo;
		nodeMeta.set(node.memoId, {
			sharedTagCount: countSharedTags(centerMemo, memo),
			recencyBucket: resolveRecencyBucket(memo.updated_at, now),
		});
	}

	const edges = buildConnectedEdges(centerMemo, nodes);

	return {
		nodes,
		edges,
		overflowCount,
		nodeMeta,
		centerMetrics: {
			connectedVisibleCount: connectedShown.length,
			candidateVisibleCount: candidateShown.length,
		},
	};
}

function resolveLayoutDimensions(
	kind: BrainNodeKind,
	geometry: BrainVariantGeometry,
	isCompact: boolean,
) {
	if (kind === "center") {
		return {
			width: isCompact
				? geometry.centerWidthMobile
				: geometry.centerWidthDesktop,
			height: isCompact
				? geometry.centerHeightMobile
				: geometry.centerHeightDesktop,
			borderRadius: geometry.centerRadius,
			radius: Math.max(
				isCompact
					? geometry.centerHeightMobile / 2
					: geometry.centerHeightDesktop / 2,
				isCompact
					? geometry.centerWidthMobile / 2
					: geometry.centerWidthDesktop / 2,
			),
			shape: "sticky" as const,
		};
	}
	if (kind === "connected") {
		return {
			width: isCompact
				? geometry.connectedWidthMobile
				: geometry.connectedWidthDesktop,
			height: isCompact
				? geometry.connectedHeightMobile
				: geometry.connectedHeightDesktop,
			borderRadius: geometry.connectedRadius,
			radius: Math.max(
				isCompact
					? geometry.connectedHeightMobile / 2
					: geometry.connectedHeightDesktop / 2,
				isCompact
					? geometry.connectedWidthMobile / 2
					: geometry.connectedWidthDesktop / 2,
			),
			shape: "sticky" as const,
		};
	}
	if (kind === "candidate") {
		return {
			width: isCompact
				? geometry.candidateWidthMobile
				: geometry.candidateWidthDesktop,
			height: isCompact
				? geometry.candidateHeightMobile
				: geometry.candidateHeightDesktop,
			borderRadius: geometry.candidateRadius,
			radius: Math.max(
				isCompact
					? geometry.candidateHeightMobile / 2
					: geometry.candidateHeightDesktop / 2,
				isCompact
					? geometry.candidateWidthMobile / 2
					: geometry.candidateWidthDesktop / 2,
			),
			shape: "sticky" as const,
		};
	}
	return {
		width: isCompact
			? geometry.overflowWidthMobile
			: geometry.overflowWidthDesktop,
		height: isCompact
			? geometry.overflowHeightMobile
			: geometry.overflowHeightDesktop,
		borderRadius: geometry.overflowRadius,
		radius: isCompact
			? geometry.overflowHeightMobile / 2
			: geometry.overflowHeightDesktop / 2,
		shape: "token" as const,
	};
}

function resolveOrganicOffset(
	index: number,
	offsets: ReadonlyArray<{ x: number; y: number }>,
) {
	if (index < offsets.length) {
		return offsets[index];
	}
	const base = offsets[index % offsets.length] ??
		offsets[offsets.length - 1] ?? {
			x: 0,
			y: 0,
		};
	const ring = Math.floor(index / offsets.length) + 1;
	return {
		x: base.x * (1 + ring * 0.12) + (index % 2 === 0 ? 0.08 : -0.08) * ring,
		y: base.y * (1 + ring * 0.1) + (index % 3 === 0 ? 0.06 : -0.04) * ring,
	};
}

function clampPosition(value: number, min: number, max: number) {
	return Math.max(min, Math.min(max, value));
}

export function clampBrainStoredPosition(position: BrainStoredPosition) {
	return {
		x: clampPosition(position.x, 0, 1),
		y: clampPosition(position.y, 0, 1),
	};
}

function resolveBrainPosition(memo: MemoRecord): BrainStoredPosition | null {
	if (
		typeof memo.brain_x === "number" &&
		Number.isFinite(memo.brain_x) &&
		typeof memo.brain_y === "number" &&
		Number.isFinite(memo.brain_y)
	) {
		return clampBrainStoredPosition({
			x: memo.brain_x,
			y: memo.brain_y,
		});
	}
	return null;
}

export function layoutBrainNodes({
	nodes,
	width,
	height,
	variant = "signal_cluster",
	positionOverrides,
}: LayoutInput): Map<BrainNodeId, BrainNodeLayout> {
	const layout = new Map<BrainNodeId, BrainNodeLayout>();
	if (nodes.length === 0 || width <= 0 || height <= 0) {
		return layout;
	}
	const geometry = getBrainVariantGeometry(variant);
	const style = getBrainVariantStyle(variant);

	const centerNode = nodes.find((node) => node.kind === "center") ?? nodes[0];
	const isCompact = Math.min(width, height) < 360;
	const centerDimensions = resolveLayoutDimensions(
		"center",
		geometry,
		isCompact,
	);
	const centerXRatio = isCompact
		? style.layout.centerXRatioMobile
		: style.layout.centerXRatioDesktop;
	const centerYRatio = isCompact
		? style.layout.centerYRatioMobile
		: style.layout.centerYRatioDesktop;
	const cx = width * centerXRatio;
	const cy = height * centerYRatio;

	layout.set(centerNode.id, {
		x: cx,
		y: cy,
		...centerDimensions,
	});

	const connectedNodes = nodes
		.filter((node) => node.kind === "connected")
		.sort((left, right) => String(left.id).localeCompare(String(right.id)));
	const candidateNodes = nodes
		.filter((node) => node.kind === "candidate")
		.sort((left, right) => String(left.id).localeCompare(String(right.id)));
	const overflowNodes = nodes
		.filter((node) => node.kind === "overflow")
		.sort((left, right) => String(left.id).localeCompare(String(right.id)));

	const placeGroup = ({
		groupNodes,
		offsets,
		orbitX,
		orbitY,
	}: {
		groupNodes: BrainNode[];
		offsets: ReadonlyArray<{ x: number; y: number }>;
		orbitX: number;
		orbitY: number;
	}) => {
		for (const [index, node] of groupNodes.entries()) {
			const dimensions = resolveLayoutDimensions(
				node.kind,
				geometry,
				isCompact,
			);
			const offset = resolveOrganicOffset(index, offsets);
			const x =
				cx +
				offset.x * orbitX * width +
				offset.y * style.layout.organicDriftX * width;
			const y =
				cy +
				offset.y * orbitY * height +
				offset.x * style.layout.organicDriftY * height;
			layout.set(node.id, {
				x: clampPosition(
					x,
					dimensions.width / 2 + 8,
					width - dimensions.width / 2 - 8,
				),
				y: clampPosition(
					y,
					dimensions.height / 2 + 8,
					height - dimensions.height / 2 - 8,
				),
				...dimensions,
			});
		}
	};

	placeGroup({
		groupNodes: connectedNodes,
		offsets: CONNECTED_CLUSTER_OFFSETS,
		orbitX: style.layout.connectedOrbitX * (isCompact ? 0.92 : 1),
		orbitY: style.layout.connectedOrbitY * (isCompact ? 0.9 : 1),
	});
	placeGroup({
		groupNodes: candidateNodes,
		offsets: CANDIDATE_CLUSTER_OFFSETS,
		orbitX: style.layout.candidateOrbitX * (isCompact ? 0.9 : 1),
		orbitY: style.layout.candidateOrbitY * (isCompact ? 0.88 : 1),
	});

	for (const [index, node] of overflowNodes.entries()) {
		const dimensions = resolveLayoutDimensions(node.kind, geometry, isCompact);
		const offset = resolveOrganicOffset(index, [OVERFLOW_OFFSET]);
		layout.set(node.id, {
			x: clampPosition(
				cx +
					offset.x * style.layout.candidateOrbitX * width +
					offset.y * style.layout.organicDriftX * width,
				dimensions.width / 2 + 8,
				width - dimensions.width / 2 - 8,
			),
			y: clampPosition(
				cy +
					offset.y * style.layout.candidateOrbitY * height +
					offset.x * style.layout.organicDriftY * height,
				dimensions.height / 2 + 8,
				height - dimensions.height / 2 - 8,
			),
			...dimensions,
		});
	}

	for (const node of nodes) {
		if (node.memoId === null) {
			continue;
		}
		const hasOverride = positionOverrides?.has(node.memoId) ?? false;
		const position = hasOverride
			? (positionOverrides?.get(node.memoId) ?? null)
			: node.brainPosition;
		if (!position) {
			continue;
		}
		const dimensions =
			layout.get(node.id) ??
			resolveLayoutDimensions(node.kind, geometry, isCompact);
		layout.set(node.id, {
			...dimensions,
			x: clampPosition(
				position.x * width,
				dimensions.width / 2 + 8,
				width - dimensions.width / 2 - 8,
			),
			y: clampPosition(
				position.y * height,
				dimensions.height / 2 + 8,
				height - dimensions.height / 2 - 8,
			),
		});
	}

	return layout;
}
