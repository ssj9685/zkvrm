import type { MemoRecord } from "@server/api/memo-api";

export type MemoSmartView =
	| "all"
	| "pinned"
	| "recent"
	| "related"
	| "untagged"
	| "orphan";

export const primarySmartViews: MemoSmartView[] = ["all", "recent"];
export const secondarySmartViews: MemoSmartView[] = [
	"pinned",
	"related",
	"untagged",
	"orphan",
];

export type MemoTagLike = {
	id: number;
	name: string;
};

export type RelatedMemoItem = {
	memoId: number;
	score: number;
	reasons: string[];
	updatedAt: number;
};

const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;

export function getQuickTagsByUsage({
	tags,
	usageCounts,
	limit = 3,
}: {
	tags: MemoTagLike[];
	usageCounts: Map<number, number>;
	limit?: number;
}): MemoTagLike[] {
	return [...tags]
		.sort((left, right) => {
			const countDiff =
				(usageCounts.get(right.id) ?? 0) - (usageCounts.get(left.id) ?? 0);
			if (countDiff !== 0) {
				return countDiff;
			}
			return left.name.localeCompare(right.name);
		})
		.slice(0, Math.max(0, limit));
}

function countSharedTags(a: MemoRecord, b: MemoRecord) {
	if (a.tags.length === 0 || b.tags.length === 0) {
		return 0;
	}
	const tagSet = new Set(a.tags.map((tag) => tag.id));
	let count = 0;
	for (const tag of b.tags) {
		if (tagSet.has(tag.id)) {
			count += 1;
		}
	}
	return count;
}

function hasDirectLink(a: MemoRecord, b: MemoRecord) {
	return (
		a.outlink_ids.includes(b.id) ||
		a.backlink_ids.includes(b.id) ||
		b.outlink_ids.includes(a.id) ||
		b.backlink_ids.includes(a.id)
	);
}

export function buildRelatedMemoItems(
	selectedMemo: MemoRecord | null,
	memos: MemoRecord[],
	now = Date.now(),
): RelatedMemoItem[] {
	if (!selectedMemo) {
		return [];
	}

	const recentThreshold = now - sevenDaysMs;
	const items: RelatedMemoItem[] = [];
	for (const memo of memos) {
		if (memo.id === selectedMemo.id) {
			continue;
		}
		const linked = hasDirectLink(selectedMemo, memo);
		const sharedTagCount = countSharedTags(selectedMemo, memo);
		const recent = memo.updated_at >= recentThreshold;
		const score =
			(linked ? 100 : 0) +
			Math.min(90, sharedTagCount * 30) +
			(recent ? 10 : 0);
		if (score <= 0) {
			continue;
		}

			const reasons: string[] = [];
			if (linked) {
				reasons.push("연결");
			}
		if (sharedTagCount > 0) {
			reasons.push(`${sharedTagCount} shared tags`);
		}
		if (recent) {
			reasons.push("Recent");
		}

		items.push({
			memoId: memo.id,
			score,
			reasons,
			updatedAt: memo.updated_at,
		});
	}

	items.sort((left, right) => {
		if (right.score !== left.score) {
			return right.score - left.score;
		}
		return right.updatedAt - left.updatedAt;
	});

	return items;
}

export function getSmartViewCounts({
	memos,
	selectedMemo,
	relatedItems,
	now = Date.now(),
}: {
	memos: MemoRecord[];
	selectedMemo: MemoRecord | null;
	relatedItems: RelatedMemoItem[];
	now?: number;
}): Record<MemoSmartView, number> {
	const recentThreshold = now - sevenDaysMs;
	const relatedCount = selectedMemo ? relatedItems.length : 0;

	let pinned = 0;
	let recent = 0;
	let untagged = 0;
	let orphan = 0;

	for (const memo of memos) {
		if (memo.is_pinned) {
			pinned += 1;
		}
		if (memo.updated_at >= recentThreshold) {
			recent += 1;
		}
		if (memo.tags.length === 0) {
			untagged += 1;
		}
		if (
			memo.tags.length === 0 &&
			memo.backlink_ids.length === 0 &&
			memo.outlink_ids.length === 0
		) {
			orphan += 1;
		}
	}

	return {
		all: memos.length,
		pinned,
		recent,
		related: relatedCount,
		untagged,
		orphan,
	};
}

export function getMemoIdsForSmartView({
	memos,
	smartView,
	selectedMemo,
	relatedItems,
	now = Date.now(),
}: {
	memos: MemoRecord[];
	smartView: MemoSmartView;
	selectedMemo: MemoRecord | null;
	relatedItems: RelatedMemoItem[];
	now?: number;
}): number[] {
	if (smartView === "related") {
		if (!selectedMemo) {
			return [];
		}
		return relatedItems.map((item) => item.memoId);
	}

	const recentThreshold = now - sevenDaysMs;
	return memos
		.filter((memo) => {
			if (smartView === "all") {
				return true;
			}
			if (smartView === "pinned") {
				return memo.is_pinned;
			}
			if (smartView === "recent") {
				return memo.updated_at >= recentThreshold;
			}
			if (smartView === "untagged") {
				return memo.tags.length === 0;
			}
			if (smartView === "orphan") {
				return (
					memo.tags.length === 0 &&
					memo.backlink_ids.length === 0 &&
					memo.outlink_ids.length === 0
				);
			}
			return true;
		})
		.map((memo) => memo.id);
}
