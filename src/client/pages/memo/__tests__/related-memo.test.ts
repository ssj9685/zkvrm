import { describe, expect, test } from "bun:test";
import type { MemoRecord } from "@server/api/memo-api";
import {
	buildRelatedMemoItems,
	getMemoIdsForSmartView,
	getQuickTagsByUsage,
	getSmartViewCounts,
	primarySmartViews,
	secondarySmartViews,
} from "../related-memo";

function createMemo({
	id,
	updated_at,
	is_pinned = false,
	tags = [],
	backlink_ids = [],
	outlink_ids = [],
}: {
	id: number;
	updated_at: number;
	is_pinned?: boolean;
	tags?: Array<{ id: number; name: string }>;
	backlink_ids?: number[];
	outlink_ids?: number[];
}): MemoRecord {
	return {
		id,
		title: `Memo ${id}`,
		content: "",
		tone: "neutral",
		is_pinned,
		created_at: updated_at,
		updated_at,
		archived_at: null,
		brain_x: null,
		brain_y: null,
		tags,
		backlink_ids,
		outlink_ids,
		pin_color: "neutral",
		connections: [],
		connected_ids: [...new Set([...backlink_ids, ...outlink_ids])],
	};
}

describe("related memo helpers", () => {
	test("smart view predicates for untagged and orphan", () => {
		const now = Date.now();
		const memos = [
			createMemo({ id: 1, updated_at: now }),
			createMemo({
				id: 2,
				updated_at: now,
				tags: [{ id: 11, name: "work" }],
			}),
			createMemo({
				id: 3,
				updated_at: now,
				outlink_ids: [1],
			}),
		];
		const relatedItems = buildRelatedMemoItems(memos[0], memos, now);
		const counts = getSmartViewCounts({
			memos,
			selectedMemo: memos[0],
			relatedItems,
			now,
		});
		expect(counts.untagged).toBe(2);
		expect(counts.orphan).toBe(1);

		const untaggedIds = getMemoIdsForSmartView({
			memos,
			smartView: "untagged",
			selectedMemo: memos[0],
			relatedItems,
			now,
		});
		expect(untaggedIds).toEqual([1, 3]);

		const orphanIds = getMemoIdsForSmartView({
			memos,
			smartView: "orphan",
			selectedMemo: memos[0],
			relatedItems,
			now,
		});
		expect(orphanIds).toEqual([1]);
	});

	test("related scoring orders linked and shared tags before recency", () => {
		const now = Date.now();
		const selected = createMemo({
			id: 10,
			updated_at: now,
			tags: [
				{ id: 1, name: "alpha" },
				{ id: 2, name: "beta" },
			],
			outlink_ids: [20],
		});
		const linked = createMemo({
			id: 20,
			updated_at: now - 20 * 24 * 60 * 60 * 1000,
		});
		const sharedTags = createMemo({
			id: 30,
			updated_at: now,
			tags: [{ id: 1, name: "alpha" }],
		});
		const recentOnly = createMemo({
			id: 40,
			updated_at: now - 2 * 24 * 60 * 60 * 1000,
		});
		const oldUnrelated = createMemo({
			id: 50,
			updated_at: now - 20 * 24 * 60 * 60 * 1000,
		});

		const items = buildRelatedMemoItems(
			selected,
			[selected, linked, sharedTags, recentOnly, oldUnrelated],
			now,
		);
		expect(items.map((item) => item.memoId)).toEqual([20, 30, 40]);
		expect(items[0]?.reasons).toContain("연결");
		expect(items[1]?.reasons).toContain("1 shared tags");
		expect(items[2]?.reasons).toContain("Recent");
	});

	test("quick tags select top three by usage and name tie-break", () => {
		const tags = [
			{ id: 10, name: "zeta" },
			{ id: 20, name: "alpha" },
			{ id: 30, name: "beta" },
			{ id: 40, name: "gamma" },
		];
		const usageCounts = new Map<number, number>([
			[10, 4],
			[20, 7],
			[30, 7],
			[40, 1],
		]);

		const quickTags = getQuickTagsByUsage({
			tags,
			usageCounts,
		});
		expect(quickTags.map((tag) => tag.id)).toEqual([20, 30, 10]);
	});

	test("smart views are split into primary and secondary groups", () => {
		expect(primarySmartViews).toEqual(["all", "recent"]);
		expect(secondarySmartViews).toEqual([
			"pinned",
			"related",
			"untagged",
			"orphan",
		]);
	});
});
