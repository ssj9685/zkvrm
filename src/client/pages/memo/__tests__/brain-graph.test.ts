import { describe, expect, test } from "bun:test";
import type { MemoRecord } from "@server/api/memo-api";
import { layoutBrainNodes, projectBrainGraph } from "../brain-graph";

function createMemo({
	id,
	title,
	content = "",
	updated_at,
	connected_ids = [],
	connections,
	tagIds = [],
	brain_x = null,
	brain_y = null,
}: {
	id: number;
	title: string;
	content?: string;
	updated_at: number;
	connected_ids?: number[];
	connections?: MemoRecord["connections"];
	tagIds?: number[];
	brain_x?: number | null;
	brain_y?: number | null;
}): MemoRecord {
	return {
		id,
		title,
		content,
		tone: "neutral",
		is_pinned: false,
		created_at: updated_at,
		updated_at,
		archived_at: null,
		brain_x,
		brain_y,
		pin_color: "neutral",
		tags: tagIds.map((tagId) => ({ id: tagId, name: `tag-${tagId}` })),
		backlink_ids: [],
		outlink_ids: [],
		connected_ids,
		connections:
			connections ??
			connected_ids.map((memoId) => ({
				memo_id: memoId,
				origin: "manual" as const,
				yarn_color: "neutral" as const,
			})),
	};
}

describe("brain graph helpers", () => {
	test("project keeps candidate nodes but creates edges only for connected ids", () => {
		const now = Date.now();
		const center = createMemo({
			id: 1,
			title: "Center",
			updated_at: now,
			connected_ids: [2],
		});
		const two = createMemo({
			id: 2,
			title: "Two",
			updated_at: now - 10,
			connected_ids: [1],
		});
		const three = createMemo({
			id: 3,
			title: "Three",
			updated_at: now - 20,
			connected_ids: [],
		});
		const projected = projectBrainGraph({
			centerMemo: center,
			memos: [center, two, three],
			nodeLimit: 24,
		});

		expect(projected.nodes.map((node) => node.id)).toEqual([1, 2, 3]);
		expect(projected.nodes.find((node) => node.id === 3)?.kind).toBe(
			"candidate",
		);
		expect(projected.edges).toHaveLength(1);
		expect(projected.edges[0]).toMatchObject({
			fromId: 1,
			toId: 2,
			connected: true,
		});
		expect(projected.overflowCount).toBe(0);
		expect(projected.centerMetrics).toEqual({
			connectedVisibleCount: 1,
			candidateVisibleCount: 1,
		});
		expect(projected.nodeMeta.get(2)?.recencyBucket).toBeDefined();
		expect(projected.nodeMeta.get(3)?.recencyBucket).toBeDefined();
	});

	test("no query still does not create candidate edges", () => {
		const now = Date.now();
		const center = createMemo({
			id: 1,
			title: "Center",
			updated_at: now,
			connected_ids: [],
		});
		const candidateA = createMemo({
			id: 2,
			title: "Candidate A",
			updated_at: now - 10,
			connected_ids: [],
		});
		const candidateB = createMemo({
			id: 3,
			title: "Candidate B",
			updated_at: now - 20,
			connected_ids: [],
		});

		const projected = projectBrainGraph({
			centerMemo: center,
			memos: [center, candidateA, candidateB],
			nodeLimit: 24,
		});
		expect(
			projected.nodes.filter((node) => node.kind === "candidate").length,
		).toBeGreaterThanOrEqual(2);
		expect(projected.edges).toHaveLength(0);
	});

	test("edge count equals connected neighbor count within node cap", () => {
		const now = Date.now();
		const center = createMemo({
			id: 1,
			title: "Center",
			updated_at: now,
			connected_ids: [2, 3, 4, 5, 6, 7, 8, 9],
		});
		const memos = [
			center,
			createMemo({
				id: 2,
				title: "A",
				updated_at: now - 10,
				connected_ids: [1],
			}),
			createMemo({
				id: 3,
				title: "B",
				updated_at: now - 20,
				connected_ids: [1],
			}),
			createMemo({
				id: 4,
				title: "C",
				updated_at: now - 30,
				connected_ids: [1],
			}),
			createMemo({
				id: 5,
				title: "D",
				updated_at: now - 40,
				connected_ids: [1],
			}),
			createMemo({
				id: 6,
				title: "E",
				updated_at: now - 50,
				connected_ids: [1],
			}),
			createMemo({
				id: 7,
				title: "F",
				updated_at: now - 60,
				connected_ids: [1],
			}),
			createMemo({
				id: 8,
				title: "G",
				updated_at: now - 70,
				connected_ids: [1],
			}),
			createMemo({
				id: 9,
				title: "H",
				updated_at: now - 80,
				connected_ids: [1],
			}),
		];

		const projected = projectBrainGraph({
			centerMemo: center,
			memos,
			nodeLimit: 4,
		});
		expect(projected.nodes.length).toBe(7);
		expect(projected.nodes.some((node) => node.id === "overflow")).toBeTruthy();
		expect(projected.edges).toHaveLength(5);
		expect(projected.overflowCount).toBeGreaterThan(0);
		expect(projected.centerMetrics.connectedVisibleCount).toBe(5);
		expect(projected.centerMetrics.candidateVisibleCount).toBe(0);
	});

	test("projection includes all reachable nodes as candidates", () => {
		const now = Date.now();
		const center = createMemo({
			id: 1,
			title: "Center",
			updated_at: now,
			connected_ids: [2],
		});
		const firstHop = createMemo({
			id: 2,
			title: "First hop",
			updated_at: now - 10,
			connected_ids: [1, 3],
		});
		const secondHop = createMemo({
			id: 3,
			title: "Second hop",
			updated_at: now - 120,
			connected_ids: [2],
		});
		const unrelated = createMemo({
			id: 4,
			title: "Unrelated",
			updated_at: now - 20,
			connected_ids: [],
		});
		const memos = [center, firstHop, secondHop, unrelated];

		const projected = projectBrainGraph({
			centerMemo: center,
			memos,
			nodeLimit: 24,
		});

		expect(projected.nodes.map((node) => node.id)).toEqual([1, 2, 4, 3]);
		expect(projected.edges).toHaveLength(1);
	});

	test("candidate ranking follows sharedTags then updated_at then id", () => {
		const now = Date.now();
		const center = createMemo({
			id: 1,
			title: "Center",
			updated_at: now,
			connected_ids: [],
			tagIds: [10, 11],
		});
		const highShared = createMemo({
			id: 2,
			title: "High shared",
			updated_at: now - 200,
			tagIds: [10, 11],
		});
		const midSharedRecent = createMemo({
			id: 3,
			title: "Mid shared recent",
			updated_at: now - 50,
			tagIds: [10],
		});
		const midSharedOlder = createMemo({
			id: 4,
			title: "Mid shared older",
			updated_at: now - 100,
			tagIds: [10],
		});
		const sameSharedNewerId = createMemo({
			id: 5,
			title: "Same shared id 5",
			updated_at: now - 300,
			tagIds: [],
		});
		const sameSharedOlderId = createMemo({
			id: 6,
			title: "Same shared id 6",
			updated_at: now - 300,
			tagIds: [],
		});

		const projected = projectBrainGraph({
			centerMemo: center,
			memos: [
				center,
				highShared,
				midSharedRecent,
				midSharedOlder,
				sameSharedNewerId,
				sameSharedOlderId,
			],
			nodeLimit: 24,
		});
		const candidateIds = projected.nodes
			.filter((node) => node.kind === "candidate")
			.map((node) => node.id);

		expect(candidateIds).toEqual([2, 3, 4, 5, 6]);
	});

	test("center metrics match projected node groups", () => {
		const now = Date.now();
		const center = createMemo({
			id: 1,
			title: "Center",
			updated_at: now,
			connected_ids: [2, 3],
		});
		const projected = projectBrainGraph({
			centerMemo: center,
			memos: [
				center,
				createMemo({
					id: 2,
					title: "A",
					updated_at: now - 10,
					connected_ids: [1],
				}),
				createMemo({
					id: 3,
					title: "B",
					updated_at: now - 20,
					connected_ids: [1],
				}),
				createMemo({
					id: 4,
					title: "C",
					updated_at: now - 30,
					connected_ids: [],
				}),
			],
			nodeLimit: 24,
		});

		const connectedCount = projected.nodes.filter(
			(node) => node.kind === "connected",
		).length;
		const candidateCount = projected.nodes.filter(
			(node) => node.kind === "candidate",
		).length;

		expect(projected.centerMetrics.connectedVisibleCount).toBe(connectedCount);
		expect(projected.centerMetrics.candidateVisibleCount).toBe(candidateCount);
	});

	test("layout is deterministic for same input", () => {
		const now = Date.now();
		const center = createMemo({
			id: 1,
			title: "Center",
			updated_at: now,
			connected_ids: [2, 3],
		});
		const projected = projectBrainGraph({
			centerMemo: center,
			memos: [
				center,
				createMemo({
					id: 2,
					title: "A",
					updated_at: now - 10,
					connected_ids: [1],
				}),
				createMemo({
					id: 3,
					title: "B",
					updated_at: now - 20,
					connected_ids: [1],
				}),
			],
			nodeLimit: 24,
		});

		const first = layoutBrainNodes({
			nodes: projected.nodes,
			width: 360,
			height: 280,
		});
		const second = layoutBrainNodes({
			nodes: projected.nodes,
			width: 360,
			height: 280,
		});

		expect([...first.entries()]).toEqual([...second.entries()]);
		expect(first.get(1)?.shape).toBe("sticky");
		expect(first.get(2)?.shape).toBe("sticky");
	});

	test("stored brain positions override fallback layout", () => {
		const now = Date.now();
		const center = createMemo({
			id: 1,
			title: "Center",
			updated_at: now,
			connected_ids: [2],
			brain_x: 0.22,
			brain_y: 0.78,
		});
		const connected = createMemo({
			id: 2,
			title: "Connected",
			updated_at: now - 10,
			connected_ids: [1],
			brain_x: 0.74,
			brain_y: 0.26,
		});
		const projected = projectBrainGraph({
			centerMemo: center,
			memos: [center, connected],
			nodeLimit: 24,
		});
		const layout = layoutBrainNodes({
			nodes: projected.nodes,
			width: 500,
			height: 360,
		});

		expect(layout.get(1)?.x).toBeCloseTo(134, 0);
		expect(layout.get(1)?.y).toBeCloseTo(254, 0);
		expect(layout.get(2)?.x).toBeCloseTo(370, 0);
		expect(layout.get(2)?.y).toBeCloseTo(93.6, 0);
	});

	test("drag position overrides win over stored coordinates during layout", () => {
		const now = Date.now();
		const center = createMemo({
			id: 1,
			title: "Center",
			updated_at: now,
			connected_ids: [2],
			brain_x: 0.2,
			brain_y: 0.2,
		});
		const connected = createMemo({
			id: 2,
			title: "Connected",
			updated_at: now - 10,
			connected_ids: [1],
			brain_x: 0.8,
			brain_y: 0.8,
		});
		const projected = projectBrainGraph({
			centerMemo: center,
			memos: [center, connected],
			nodeLimit: 24,
		});
		const layout = layoutBrainNodes({
			nodes: projected.nodes,
			width: 500,
			height: 360,
			positionOverrides: new Map([[2, { x: 0.46, y: 0.61 }]]),
		});

		expect(layout.get(2)?.x).toBeCloseTo(230, 0);
		expect(layout.get(2)?.y).toBeCloseTo(220, 0);
	});

	test("connected nodes stay closer to center than candidates", () => {
		const now = Date.now();
		const center = createMemo({
			id: 1,
			title: "Center",
			updated_at: now,
			connected_ids: [2, 3],
		});
		const projected = projectBrainGraph({
			centerMemo: center,
			memos: [
				center,
				createMemo({
					id: 2,
					title: "A",
					updated_at: now - 10,
					connected_ids: [1],
				}),
				createMemo({
					id: 3,
					title: "B",
					updated_at: now - 20,
					connected_ids: [1],
				}),
				createMemo({
					id: 4,
					title: "C",
					updated_at: now - 30,
					connected_ids: [],
				}),
				createMemo({
					id: 5,
					title: "D",
					updated_at: now - 40,
					connected_ids: [],
				}),
			],
			nodeLimit: 24,
		});
		const layout = layoutBrainNodes({
			nodes: projected.nodes,
			width: 420,
			height: 320,
		});
		const centerLayout = layout.get(1);
		const connectedLayout = layout.get(2);
		const candidateLayout = layout.get(4);

		expect(centerLayout).toBeDefined();
		expect(connectedLayout).toBeDefined();
		expect(candidateLayout).toBeDefined();

		const connectedDistance = Math.hypot(
			(connectedLayout?.x ?? 0) - (centerLayout?.x ?? 0),
			(connectedLayout?.y ?? 0) - (centerLayout?.y ?? 0),
		);
		const candidateDistance = Math.hypot(
			(candidateLayout?.x ?? 0) - (centerLayout?.x ?? 0),
			(candidateLayout?.y ?? 0) - (centerLayout?.y ?? 0),
		);

		expect(connectedDistance).toBeLessThan(candidateDistance);
	});

	test("content-based search matches memos by content", () => {
		const now = Date.now();
		const center = createMemo({
			id: 1,
			title: "Center",
			updated_at: now,
			connected_ids: [],
		});
		const matchByContent = createMemo({
			id: 2,
			title: "Unrelated title",
			content: "important keyword here",
			updated_at: now - 10,
		});
		const noMatch = createMemo({
			id: 3,
			title: "No match",
			content: "nothing relevant",
			updated_at: now - 20,
		});

		const projected = projectBrainGraph({
			centerMemo: center,
			memos: [center, matchByContent, noMatch],
			nodeLimit: 24,
			searchQuery: "keyword",
		});

		const candidateIds = projected.nodes
			.filter((node) => node.kind === "candidate")
			.map((node) => node.id);
		expect(candidateIds).toContain(2);
		expect(candidateIds).not.toContain(3);
	});

	test("edges carry yarn color from connections", () => {
		const now = Date.now();
		const center = createMemo({
			id: 1,
			title: "Center",
			updated_at: now,
			connected_ids: [2],
			connections: [
				{ memo_id: 2, origin: "manual" as const, yarn_color: "violet" as const },
			],
		});
		const connected = createMemo({
			id: 2,
			title: "Connected",
			updated_at: now - 10,
			connected_ids: [1],
		});

		const projected = projectBrainGraph({
			centerMemo: center,
			memos: [center, connected],
			nodeLimit: 24,
		});

		expect(projected.edges).toHaveLength(1);
		expect(projected.edges[0]?.yarnColor).toBe("violet");
	});
});
