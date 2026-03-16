import { Button } from "@client/components/button";
import { Icon } from "@client/components/icons/icon";
import { PopoverMenu } from "@client/components/popover-menu";
import { toast } from "@client/components/toast/toast-overlay";
import { useDebounceCallback } from "@client/hooks/use-debounce-callback";
import { cn } from "@client/lib/utils/cn";
import { authStore } from "@client/store/auth";
import { memoStore } from "@client/store/memo";
import { routeStore } from "@client/store/route";
import { useStore } from "@ga-ut/store-react";
import type { MemoRecord, MemoSort, MemoTone } from "@server/api/memo-api";
import { normalizeMemoQuery } from "@shared/memo-query";
import {
	type Dispatch,
	type ReactNode,
	type PointerEvent as ReactPointerEvent,
	type WheelEvent as ReactWheelEvent,
	type SetStateAction,
	useCallback,
	useEffect,
	useMemo,
	useRef,
	useState,
} from "react";
import {
	type BrainEdge,
	type BrainGraphProjection,
	type BrainNodeId,
	type BrainNodeLayout,
	type BrainNodeShapeKind,
	type BrainStoredPosition,
	clampBrainStoredPosition,
	layoutBrainNodes,
	projectBrainGraph,
} from "./brain-graph";
import { hasMemoHit } from "./brain-hit";
import {
	clampFloatingWindowPoint,
	type FloatingWindowPoint,
	resolveSelectedWindowAutoPosition,
} from "./brain-window";
import {
	type BrainChromeDensity,
	type BrainVariantStyle,
	brainNodeShape,
	getBrainVariantGeometry,
	getBrainVariantStyle,
	getDefaultBrainChromeDensity,
	type MemoDesignVariant,
	memoTheme,
} from "./design-variant";
import {
	buildRelatedMemoItems,
	getMemoIdsForSmartView,
	getSmartViewCounts,
	type MemoSmartView,
	secondarySmartViews,
} from "./related-memo";

type SaveState = "idle" | "saving" | "saved" | "error";
type ViewMode = "list" | "gallery";
type DensityMode = "compact" | "comfortable";
type SmartView = MemoSmartView;
type SheetSnap = "peek" | "mid" | "full";
type ResolvedSheetState = "close" | SheetSnap;
type OrganizeTab = "tags" | "filters";
type BrainViewportState = {
	panX: number;
	panY: number;
	zoom: number;
};
type BrainTrailItem = {
	centerId: number;
	timestamp: number;
};
type BrainVisualMode = MemoDesignVariant;
type BrainNodeVisualState =
	| "center"
	| "connected"
	| "candidate"
	| "overflow"
	| "selected"
	| "hovered"
	| "focus-neighbor";
type BrainCanvasPoint = {
	x: number;
	y: number;
};
type BrainCanvasNodeHit = {
	id: BrainNodeId;
	memoId: number | null;
	x: number;
	y: number;
	layoutX: number;
	layoutY: number;
	layoutWidth: number;
	layoutHeight: number;
	width: number;
	height: number;
	borderRadius: number;
	radius: number;
	shape: BrainNodeShapeKind;
	visualState: BrainNodeVisualState;
};
type BrainCanvasEdgeHit = {
	edge: BrainEdge;
	points: BrainCanvasPoint[];
	midPoint: BrainCanvasPoint;
	highlighted: boolean;
};
type BrainCanvasInteractionState = {
	nodes: BrainCanvasNodeHit[];
	edges: BrainCanvasEdgeHit[];
};
type BrainSelectedWindowState = {
	isOpen: boolean;
	position: FloatingWindowPoint | null;
	hasManualPlacement: boolean;
};
type BrainPointerTarget = "pan" | "node" | "click";
type FilterAccordionSection = "smartViews" | "sort" | "tone" | "tags";
type FilterAccordionState = Record<FilterAccordionSection, boolean>;

const toneOptions: Array<{
	key: MemoTone;
	label: string;
	dotClass: string;
	chipClass: string;
	accentClass: string;
}> = [
	{
		key: "neutral",
		label: "기본",
		dotClass: "bg-[#d0d5dc]",
		chipClass: "bg-[#eef1f4] text-[#1c2430]",
		accentClass: "border-l-[#9ba5b4]",
	},
	{
		key: "sun",
		label: "햇살",
		dotClass: "bg-[#d6c79f]",
		chipClass: "bg-[#ece4cf] text-[#2b2b22]",
		accentClass: "border-l-[#b6a36f]",
	},
	{
		key: "peach",
		label: "피치",
		dotClass: "bg-[#d9bbb0]",
		chipClass: "bg-[#f0e1dc] text-[#2e2322]",
		accentClass: "border-l-[#bc9488]",
	},
	{
		key: "violet",
		label: "보라",
		dotClass: "bg-[#c6c0dd]",
		chipClass: "bg-[#e6e4f1] text-[#242337]",
		accentClass: "border-l-[#9d95c1]",
	},
	{
		key: "aqua",
		label: "아쿠아",
		dotClass: "bg-[#bbd0d7]",
		chipClass: "bg-[#dce7ea] text-[#1f2c32]",
		accentClass: "border-l-[#89a8b2]",
	},
	{
		key: "lime",
		label: "라임",
		dotClass: "bg-[#c8d2b2]",
		chipClass: "bg-[#e4ead7] text-[#242b1f]",
		accentClass: "border-l-[#9eaf7f]",
	},
];

const sortOptions: Array<{ value: MemoSort; label: string }> = [
	{ value: "updated_desc", label: "최근 수정" },
	{ value: "created_desc", label: "최근 생성" },
	{ value: "title_asc", label: "제목" },
];

const isMobileWidth = () => window.matchMedia("(max-width: 1023px)").matches;
const mobilePinControlStorageKeyPrefix =
	"zkvrm:memo:mobile:pin-control-hidden:v1:";
const filtersAccordionStorageKeyPrefix = "zkvrm:memo:filters:accordion:v1:";
const mobileSheetSnapHeights: Record<SheetSnap, number> = {
	peek: 56,
	mid: 80,
	full: 100,
};
const mobileSheetCloseBoundaryDvh = 28;
const mobileSheetPeekBoundaryDvh = 68;
const mobileSheetMidBoundaryDvh = 90;
const defaultFilterAccordionState: FilterAccordionState = {
	smartViews: false,
	sort: false,
	tone: false,
	tags: false,
};
const defaultBrainViewport: BrainViewportState = {
	panX: 0,
	panY: 0,
	zoom: 1,
};
const brainSelectedWindowSize = {
	width: 420,
	height: 560,
};
const brainSelectedWindowMargin = 16;
const smartViewLabels: Record<SmartView, string> = {
	all: "전체",
	recent: "최근",
	pinned: "핀",
	related: "연결됨",
	untagged: "태그 없음",
	orphan: "고립",
};

function normalizeFilterAccordionState(
	value: unknown,
): FilterAccordionState | null {
	if (!value || typeof value !== "object") {
		return null;
	}
	const input = value as Partial<FilterAccordionState>;
	return {
		smartViews: Boolean(input.smartViews),
		sort: Boolean(input.sort),
		tone: Boolean(input.tone),
		tags: Boolean(input.tags),
	};
}

function getViewportHeightPx() {
	return window.innerHeight || document.documentElement.clientHeight || 0;
}

function clampBrainZoom(value: number) {
	return Math.min(1.6, Math.max(0.75, value));
}

function resolveBrainCanvasMetrics(width: number, height: number) {
	const safePadding = width < 768 ? 28 : 42;
	return {
		safePadding,
		contentWidth: Math.max(160, width - safePadding * 2),
		contentHeight: Math.max(140, height - safePadding * 2),
		cx: width / 2,
		cy: height / 2,
	};
}

function toBrainCanvasScreenPoint(
	metrics: ReturnType<typeof resolveBrainCanvasMetrics>,
	viewport: BrainViewportState,
	x: number,
	y: number,
) {
	const worldX = metrics.safePadding + x;
	const worldY = metrics.safePadding + y;
	return {
		x: metrics.cx + (worldX - metrics.cx) * viewport.zoom + viewport.panX,
		y: metrics.cy + (worldY - metrics.cy) * viewport.zoom + viewport.panY,
	};
}

function toBrainCanvasLocalPoint(
	metrics: ReturnType<typeof resolveBrainCanvasMetrics>,
	viewport: BrainViewportState,
	screenX: number,
	screenY: number,
) {
	const worldX =
		metrics.cx + (screenX - viewport.panX - metrics.cx) / viewport.zoom;
	const worldY =
		metrics.cy + (screenY - viewport.panY - metrics.cy) / viewport.zoom;
	return {
		x: worldX - metrics.safePadding,
		y: worldY - metrics.safePadding,
	};
}

function snapHeightToPixels(snap: SheetSnap, viewportHeightPx: number) {
	return (mobileSheetSnapHeights[snap] / 100) * viewportHeightPx;
}

function resolveSheetStateFromHeight(
	heightPx: number,
	viewportHeightPx: number,
): ResolvedSheetState {
	if (viewportHeightPx <= 0) {
		return "mid";
	}
	const clampedHeight = Math.max(0, Math.min(heightPx, viewportHeightPx));
	const currentDvh = (clampedHeight / viewportHeightPx) * 100;
	if (currentDvh < mobileSheetCloseBoundaryDvh) {
		return "close";
	}
	if (currentDvh < mobileSheetPeekBoundaryDvh) {
		return "peek";
	}
	if (currentDvh < mobileSheetMidBoundaryDvh) {
		return "mid";
	}
	return "full";
}

async function handleDownload() {
	const { blob, filename } = await memoStore.getState().download();
	const url = window.URL.createObjectURL(blob);
	const anchor = document.createElement("a");
	anchor.href = url;
	anchor.download = filename;
	document.body.appendChild(anchor);
	anchor.click();
	anchor.remove();
	window.URL.revokeObjectURL(url);
}

function toneMeta(tone: MemoTone) {
	return toneOptions.find((option) => option.key === tone) ?? toneOptions[0];
}

function toMemoTestSlug(value: string) {
	return value
		.trim()
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "");
}

export function MemoPage() {
	const { user, logout } = useStore(authStore);
	const {
		memos,
		brainMemos,
		tags,
		activeFilters,
		refreshAll,
		setQuery,
		setSort,
		setTone,
		setTagFilter,
		create,
		update,
		setMeta,
		setBrainPosition,
		setMemoTags,
		upsertTag,
		connectMemo,
		setConnectionStyle,
		disconnectMemo,
		deleteTag,
		remove,
		isLoading,
	} = useStore(memoStore);
	const router = useStore(routeStore);
	const designVariant: MemoDesignVariant = memoTheme;
	const brainChromeDensity: BrainChromeDensity = getDefaultBrainChromeDensity();
	const [smartView, setSmartView] = useState<SmartView>("all");
	const [selectedMemoId, setSelectedMemoId] = useState<number | null>(null);
	const [brainCenterId, setBrainCenterId] = useState<number | null>(null);
	const [searchTerm, setSearchTerm] = useState(activeFilters.query ?? "");
	const [selectedTagFilters, setSelectedTagFilters] = useState<number[]>(
		activeFilters.tagIds ?? [],
	);
	const [editorText, setEditorText] = useState("");
	const [titleDraft, setTitleDraft] = useState("");
	const [saveState, setSaveState] = useState<SaveState>("idle");
	const [tagInput, setTagInput] = useState("");
	const [isMobileEditorOpen, setIsMobileEditorOpen] = useState(false);
	const [mobileSheetSnap, setMobileSheetSnap] = useState<SheetSnap>("mid");
	const [isMobileSheetDragging, setIsMobileSheetDragging] = useState(false);
	const [mobileSheetDragHeightPx, setMobileSheetDragHeightPx] = useState<
		number | null
	>(null);
	const [mobileSheetResolvedState, setMobileSheetResolvedState] =
		useState<ResolvedSheetState | null>(null);
	const [mobilePinControlHidden, setMobilePinControlHidden] = useState(false);
	const [isOrganizeOpen, setIsOrganizeOpen] = useState(false);
	const [organizeTab, setOrganizeTab] = useState<OrganizeTab>("tags");
	const [organizeTagInput, setOrganizeTagInput] = useState("");
	const [filterAccordion, setFilterAccordion] = useState<FilterAccordionState>(
		defaultFilterAccordionState,
	);
	const [isFilterAccordionReady, setIsFilterAccordionReady] = useState(false);
	const [draftYarnColor, setDraftYarnColor] = useState<MemoTone>("neutral");

	const selectedMemoIdRef = useRef<number | null>(null);
	const contentRef = useRef<string | null>(null);
	const titleRef = useRef<string | null>(null);
	const loadedMemoIdRef = useRef<number | null>(null);
	const sheetDragStartYRef = useRef<number | null>(null);
	const sheetDragStartHeightPxRef = useRef<number | null>(null);
	const sheetDragPointerIdRef = useRef<number | null>(null);

	const debouncedSearch = useDebounceCallback((query: string) => {
		void setQuery(query);
	}, 320);

	const persistMemoContent = useCallback(
		async ({ id, content }: { id: number; content: string }) => {
			try {
				await update({ id, content });
				if (selectedMemoIdRef.current === id) {
					setSaveState("saved");
				}
			} catch (_) {
				if (selectedMemoIdRef.current === id) {
					setSaveState("error");
				}
				toast.open("저장에 실패했습니다");
			}
		},
		[update],
	);

	const debouncedPersist = useDebounceCallback(persistMemoContent, 360);

	useEffect(() => {
		void refreshAll({ sort: "updated_desc" });
	}, [refreshAll]);

	useEffect(() => {
		selectedMemoIdRef.current = selectedMemoId;
	}, [selectedMemoId]);

	useEffect(() => {
		if (activeFilters.query !== undefined) {
			setSearchTerm(activeFilters.query);
			return;
		}
		setSearchTerm("");
	}, [activeFilters.query]);

	useEffect(() => {
		setSelectedTagFilters(activeFilters.tagIds ?? []);
	}, [activeFilters.tagIds]);

	const mobilePinControlStorageKey = useMemo(() => {
		if (!user?.id) {
			return null;
		}
		return `${mobilePinControlStorageKeyPrefix}${user.id}`;
	}, [user?.id]);
	const filtersAccordionStorageKey = useMemo(() => {
		if (!user?.id) {
			return null;
		}
		return `${filtersAccordionStorageKeyPrefix}${user.id}`;
	}, [user?.id]);

	useEffect(() => {
		if (!mobilePinControlStorageKey) {
			setMobilePinControlHidden(false);
			return;
		}
		try {
			const saved = window.localStorage.getItem(mobilePinControlStorageKey);
			setMobilePinControlHidden(saved === "1");
		} catch (_) {
			setMobilePinControlHidden(false);
		}
	}, [mobilePinControlStorageKey]);

	useEffect(() => {
		setIsFilterAccordionReady(false);
		if (!filtersAccordionStorageKey) {
			setFilterAccordion(defaultFilterAccordionState);
			setIsFilterAccordionReady(true);
			return;
		}
		try {
			const raw = window.localStorage.getItem(filtersAccordionStorageKey);
			if (!raw) {
				setFilterAccordion(defaultFilterAccordionState);
				setIsFilterAccordionReady(true);
				return;
			}
			const parsed = JSON.parse(raw) as unknown;
			const normalized = normalizeFilterAccordionState(parsed);
			setFilterAccordion(normalized ?? defaultFilterAccordionState);
		} catch (_) {
			setFilterAccordion(defaultFilterAccordionState);
		}
		setIsFilterAccordionReady(true);
	}, [filtersAccordionStorageKey]);

	useEffect(() => {
		if (!filtersAccordionStorageKey || !isFilterAccordionReady) {
			return;
		}
		try {
			window.localStorage.setItem(
				filtersAccordionStorageKey,
				JSON.stringify(filterAccordion),
			);
		} catch (_) {
			// localStorage may be unavailable in restricted contexts.
		}
	}, [filterAccordion, filtersAccordionStorageKey, isFilterAccordionReady]);

	useEffect(() => {
		if (!isMobileEditorOpen && !(isOrganizeOpen && isMobileWidth())) {
			return;
		}
		const previousOverflow = document.body.style.overflow;
		document.body.style.overflow = "hidden";
		return () => {
			document.body.style.overflow = previousOverflow;
		};
	}, [isMobileEditorOpen, isOrganizeOpen]);

	useEffect(() => {
		if (!brainMemos.length) {
			setSelectedMemoId(null);
			setBrainCenterId(null);
			setEditorText("");
			setTitleDraft("");
			setSaveState("idle");
			setIsMobileEditorOpen(false);
			setMobileSheetSnap("mid");
			return;
		}

		if (selectedMemoId === null) {
			setSelectedMemoId(brainMemos[0].id);
			setBrainCenterId(brainMemos[0].id);
			return;
		}

		if (!brainMemos.some((memo) => memo.id === selectedMemoId)) {
			setSelectedMemoId(brainMemos[0].id);
		}
		if (brainCenterId === null) {
			setBrainCenterId(brainMemos[0].id);
			return;
		}
		if (!brainMemos.some((memo) => memo.id === brainCenterId)) {
			setBrainCenterId(brainMemos[0].id);
		}
	}, [brainCenterId, brainMemos, selectedMemoId]);

	const memoMap = useMemo(() => {
		const next = new Map<number, MemoRecord>();
		for (const memo of memos) {
			next.set(memo.id, memo);
		}
		return next;
	}, [memos]);
	const brainMemoMap = useMemo(() => {
		const next = new Map<number, MemoRecord>();
		for (const memo of brainMemos) {
			next.set(memo.id, memo);
		}
		return next;
	}, [brainMemos]);
	const selectedMemo = useMemo(() => {
		if (selectedMemoId === null) {
			return null;
		}
		return brainMemoMap.get(selectedMemoId) ?? null;
	}, [brainMemoMap, selectedMemoId]);
	const brainCenterMemo = useMemo(() => {
		if (brainCenterId === null) {
			return selectedMemo;
		}
		return brainMemoMap.get(brainCenterId) ?? selectedMemo;
	}, [brainCenterId, brainMemoMap, selectedMemo]);

	useEffect(() => {
		if (smartView !== "related" || selectedMemo) {
			return;
		}
		setSmartView("all");
	}, [smartView, selectedMemo]);

	useEffect(() => {
		if (!selectedMemo) {
			debouncedPersist.cancel();
			loadedMemoIdRef.current = null;
			contentRef.current = null;
			titleRef.current = null;
			setEditorText("");
			setTitleDraft("");
			setSaveState("idle");
			return;
		}

		if (loadedMemoIdRef.current !== selectedMemo.id) {
			debouncedPersist.cancel();
			loadedMemoIdRef.current = selectedMemo.id;
			contentRef.current = selectedMemo.content;
			titleRef.current = selectedMemo.title;
			setEditorText(selectedMemo.content);
			setTitleDraft(selectedMemo.title);
			setSaveState("idle");
			return;
		}

		if (saveState === "saving") {
			return;
		}

		if (contentRef.current !== selectedMemo.content) {
			contentRef.current = selectedMemo.content;
			setEditorText(selectedMemo.content);
		}

		if (titleRef.current !== selectedMemo.title) {
			titleRef.current = selectedMemo.title;
			setTitleDraft(selectedMemo.title);
		}
	}, [selectedMemo, debouncedPersist, saveState]);

	const handleSmartViewChange = (next: SmartView) => {
		setSmartView(next);
	};

	const handleSearchChange = (value: string) => {
		setSearchTerm(value);
		debouncedSearch(value);
	};

	const clearSearch = () => {
		debouncedSearch.cancel();
		setSearchTerm("");
		void setQuery("");
	};

	const toggleMobilePinControlHidden = useCallback(() => {
		setMobilePinControlHidden((previous) => {
			const next = !previous;
			if (mobilePinControlStorageKey) {
				try {
					window.localStorage.setItem(
						mobilePinControlStorageKey,
						next ? "1" : "0",
					);
				} catch (_) {
					// localStorage may be unavailable in restricted contexts.
				}
			}
			return next;
		});
	}, [mobilePinControlStorageKey]);

	const resetMobileSheetDrag = useCallback(() => {
		sheetDragStartYRef.current = null;
		sheetDragStartHeightPxRef.current = null;
		sheetDragPointerIdRef.current = null;
		setIsMobileSheetDragging(false);
		setMobileSheetDragHeightPx(null);
		setMobileSheetResolvedState(null);
	}, []);

	const closeMobileEditor = useCallback(() => {
		resetMobileSheetDrag();
		setIsMobileEditorOpen(false);
		setMobileSheetSnap("mid");
	}, [resetMobileSheetDrag]);

	const handleSelectMemo = useCallback((memoId: number) => {
		setSelectedMemoId(memoId);
		if (isMobileWidth()) {
			setMobileSheetSnap("mid");
			setIsMobileEditorOpen(true);
		}
	}, []);

	const handleOpenMemo = useCallback(
		(memoId: number) => {
			handleSelectMemo(memoId);
		},
		[handleSelectMemo],
	);

	const handleCreateMemo = async () => {
		try {
			const created = await create({
				content: "",
				title: "제목 없는 메모",
				tone: "sun",
			});
			if (!created) {
				return;
			}
			const baseX = brainCenterMemo?.brain_x ?? 0.5;
			const baseY = brainCenterMemo?.brain_y ?? 0.5;
			await setBrainPosition({
				id: created.id,
				x: Math.min(0.92, baseX + 0.06),
				y: Math.min(0.88, baseY + 0.04),
			});
			setSelectedMemoId(created.id);
			if (isMobileWidth()) {
				setMobileSheetSnap("mid");
				setIsMobileEditorOpen(true);
			}
		} catch (_) {
			toast.open("메모를 만들지 못했습니다");
		}
	};

	const handleSetMobileSheetSnap = useCallback((nextSnap: SheetSnap) => {
		setMobileSheetSnap(nextSnap);
	}, []);

	const handleSheetDragStart = useCallback(
		(event: ReactPointerEvent<HTMLButtonElement>) => {
			const viewportHeightPx = getViewportHeightPx();
			setIsMobileSheetDragging(true);
			sheetDragStartYRef.current = event.clientY;
			sheetDragStartHeightPxRef.current = snapHeightToPixels(
				mobileSheetSnap,
				viewportHeightPx,
			);
			sheetDragPointerIdRef.current = event.pointerId;
			setMobileSheetDragHeightPx(sheetDragStartHeightPxRef.current);
			setMobileSheetResolvedState(mobileSheetSnap);
			event.currentTarget.setPointerCapture(event.pointerId);
		},
		[mobileSheetSnap],
	);

	const handleSheetDragMove = useCallback(
		(event: ReactPointerEvent<HTMLButtonElement>) => {
			if (
				sheetDragStartYRef.current === null ||
				sheetDragStartHeightPxRef.current === null ||
				sheetDragPointerIdRef.current !== event.pointerId
			) {
				return;
			}
			const viewportHeightPx = getViewportHeightPx();
			const deltaY = event.clientY - sheetDragStartYRef.current;
			const nextHeightPx = Math.max(
				0,
				Math.min(sheetDragStartHeightPxRef.current - deltaY, viewportHeightPx),
			);
			setMobileSheetDragHeightPx(nextHeightPx);
			setMobileSheetResolvedState(
				resolveSheetStateFromHeight(nextHeightPx, viewportHeightPx),
			);
		},
		[],
	);

	const handleSheetDragEnd = useCallback(
		(event: ReactPointerEvent<HTMLButtonElement>) => {
			if (
				sheetDragStartYRef.current === null ||
				sheetDragStartHeightPxRef.current === null
			) {
				return;
			}

			if (event.currentTarget.hasPointerCapture(event.pointerId)) {
				event.currentTarget.releasePointerCapture(event.pointerId);
			}

			const viewportHeightPx = getViewportHeightPx();
			const deltaY = event.clientY - sheetDragStartYRef.current;
			const finalHeightPx = Math.max(
				0,
				Math.min(sheetDragStartHeightPxRef.current - deltaY, viewportHeightPx),
			);
			const resolvedState = resolveSheetStateFromHeight(
				finalHeightPx,
				viewportHeightPx,
			);
			resetMobileSheetDrag();

			if (resolvedState === "close") {
				closeMobileEditor();
				return;
			}
			setMobileSheetSnap(resolvedState);
		},
		[closeMobileEditor, resetMobileSheetDrag],
	);

	const handleSheetDragCancel = useCallback(
		(event: ReactPointerEvent<HTMLButtonElement>) => {
			if (event.currentTarget.hasPointerCapture(event.pointerId)) {
				event.currentTarget.releasePointerCapture(event.pointerId);
			}
			resetMobileSheetDrag();
		},
		[resetMobileSheetDrag],
	);

	const handleDeleteMemo = () => {
		if (!selectedMemo) {
			return;
		}
		void remove({ id: selectedMemo.id }).catch(() => {
			toast.open("삭제에 실패했습니다");
		});
		closeMobileEditor();
		setSaveState("idle");
	};

	const handleEditorChange = (value: string) => {
		if (!selectedMemo) {
			return;
		}
		contentRef.current = value;
		setEditorText(value);
		setSaveState("saving");
		debouncedPersist({ id: selectedMemo.id, content: value });
	};

	const commitTitle = async (nextTitle?: string) => {
		if (!selectedMemo) {
			return;
		}
		const normalized = (nextTitle ?? titleDraft).trim() || "제목 없는 메모";
		if (normalized === selectedMemo.title) {
			setTitleDraft(normalized);
			return;
		}
		setSaveState("saving");
		try {
			await setMeta({ id: selectedMemo.id, title: normalized });
			titleRef.current = normalized;
			if (selectedMemoIdRef.current === selectedMemo.id) {
				setSaveState("saved");
			}
		} catch (_) {
			if (selectedMemoIdRef.current === selectedMemo.id) {
				setSaveState("error");
			}
			toast.open("제목을 바꾸지 못했습니다");
		}
	};

	const handleTogglePinned = () => {
		if (!selectedMemo) {
			return;
		}
		void setMeta({
			id: selectedMemo.id,
			is_pinned: !selectedMemo.is_pinned,
		}).catch(() => {
			toast.open("핀 상태를 바꾸지 못했습니다");
		});
	};

	const handleToneChange = (tone: MemoTone) => {
		if (!selectedMemo) {
			return;
		}
		void setMeta({ id: selectedMemo.id, tone }).catch(() => {
			toast.open("메모 색을 바꾸지 못했습니다");
		});
	};

	const handlePinColorChange = (pinColor: MemoTone) => {
		if (!selectedMemo) {
			return;
		}
		void setMeta({ id: selectedMemo.id, pin_color: pinColor }).catch(() => {
			toast.open("핀 색을 바꾸지 못했습니다");
		});
	};

	const handleDownloadClick = () => {
		handleDownload().catch(() => {
			toast.open("다운로드에 실패했습니다");
		});
	};

	const handleLogout = () => {
		void logout();
		router.goto("/sign-in");
	};

	const toggleTagFilter = (tagId: number) => {
		const next = selectedTagFilters.includes(tagId)
			? selectedTagFilters.filter((id) => id !== tagId)
			: [...selectedTagFilters, tagId];
		setSelectedTagFilters(next);
		void setTagFilter(next);
	};

	const handleMemoTagToggle = (tagId: number) => {
		if (!selectedMemo) {
			return;
		}
		const current = selectedMemo.tags.map((tag) => tag.id);
		const next = current.includes(tagId)
			? current.filter((id) => id !== tagId)
			: [...current, tagId];
		void setMemoTags({ memoId: selectedMemo.id, tagIds: next }).catch(() => {
			toast.open("태그를 바꾸지 못했습니다");
		});
	};

	const handleCreateTag = async () => {
		if (!selectedMemo) {
			return;
		}
		const normalized = tagInput.trim();
		if (!normalized) {
			return;
		}

		try {
			const createdTag = await upsertTag({ name: normalized });
			setTagInput("");
			const current = selectedMemo.tags.map((tag) => tag.id);
			const next = [...new Set([...current, createdTag.id])];
			await setMemoTags({ memoId: selectedMemo.id, tagIds: next });
		} catch (_) {
			toast.open("태그를 만들지 못했습니다");
		}
	};

	const handleConnectMemo = ({
		memoAId,
		memoBId,
		yarnColor,
	}: {
		memoAId: number;
		memoBId: number;
		yarnColor?: MemoTone;
	}) => {
		void connectMemo({ memoAId, memoBId, yarnColor }).catch(() => {
			toast.open("연결을 만들지 못했습니다");
		});
	};

	const handleDisconnectMemo = ({
		memoAId,
		memoBId,
	}: {
		memoAId: number;
		memoBId: number;
	}) => {
		void disconnectMemo({ memoAId, memoBId }).catch(() => {
			toast.open("연결을 해제하지 못했습니다");
		});
	};

	const handleSetBrainPosition = ({
		id,
		x,
		y,
	}: {
		id: number;
		x: number | null;
		y: number | null;
	}) => {
		void setBrainPosition({ id, x, y }).catch(() => {
			toast.open("노드 위치를 저장하지 못했습니다");
		});
	};

	const handleSetConnectionStyle = useCallback(
		(yarnColor: MemoTone) => {
			if (
				!brainCenterMemo ||
				!selectedMemo ||
				brainCenterMemo.id === selectedMemo.id
			) {
				setDraftYarnColor(yarnColor);
				return;
			}
			setDraftYarnColor(yarnColor);
			const isConnected = brainCenterMemo.connected_ids.includes(
				selectedMemo.id,
			);
			if (!isConnected) {
				return;
			}
			void setConnectionStyle({
				memoAId: brainCenterMemo.id,
				memoBId: selectedMemo.id,
				yarnColor,
			}).catch(() => {
				toast.open("실 색을 바꾸지 못했습니다");
			});
		},
		[brainCenterMemo, selectedMemo, setConnectionStyle],
	);

	const handleCreateTagFromOrganize = async () => {
		const normalized = organizeTagInput.trim();
		if (!normalized) {
			return;
		}
		try {
			await upsertTag({ name: normalized });
			setOrganizeTagInput("");
		} catch (_) {
			toast.open("태그를 만들지 못했습니다");
		}
	};

	const handleRenameTagFromOrganize = (tagId: number, name: string) => {
		void upsertTag({ id: tagId, name }).catch(() => {
			toast.open("태그 이름을 바꾸지 못했습니다");
		});
	};

	const handleDeleteTagFromOrganize = (tagId: number) => {
		void deleteTag({ id: tagId })
			.then(() => {
				if (!selectedTagFilters.includes(tagId)) {
					return;
				}
				const next = selectedTagFilters.filter((id) => id !== tagId);
				setSelectedTagFilters(next);
				void setTagFilter(next);
			})
			.catch(() => {
				toast.open("태그를 지우지 못했습니다");
			});
	};

	const handleCenterSelectedMemo = useCallback(() => {
		if (!selectedMemo) {
			return;
		}
		setBrainCenterId(selectedMemo.id);
	}, [selectedMemo]);

	const handleConnectSelectedMemo = useCallback(() => {
		if (
			!brainCenterMemo ||
			!selectedMemo ||
			brainCenterMemo.id === selectedMemo.id
		) {
			return;
		}
		handleConnectMemo({
			memoAId: brainCenterMemo.id,
			memoBId: selectedMemo.id,
			yarnColor: draftYarnColor,
		});
	}, [brainCenterMemo, draftYarnColor, selectedMemo]);

	const handleDisconnectSelectedMemo = useCallback(() => {
		if (
			!brainCenterMemo ||
			!selectedMemo ||
			brainCenterMemo.id === selectedMemo.id
		) {
			return;
		}
		handleDisconnectMemo({
			memoAId: brainCenterMemo.id,
			memoBId: selectedMemo.id,
		});
	}, [brainCenterMemo, selectedMemo]);

	const openOrganizeHub = (tab: OrganizeTab) => {
		setOrganizeTab(tab);
		setIsOrganizeOpen(true);
	};

	const closeOrganizeHub = () => {
		setIsOrganizeOpen(false);
	};

	const toggleFilterAccordion = (section: FilterAccordionSection) => {
		setFilterAccordion((previous) => ({
			...previous,
			[section]: !previous[section],
		}));
	};

	const handleSortChange = (sort: MemoSort) => {
		void setSort(sort);
	};

	const handleToneFilterChange = (tone: MemoTone | undefined) => {
		void setTone(tone);
	};

	const handleResetFilters = async () => {
		debouncedSearch.cancel();
		setSmartView("all");
		setSearchTerm("");
		setSelectedTagFilters([]);
		setFilterAccordion(defaultFilterAccordionState);
		try {
			await refreshAll({
				query: "",
				sort: "updated_desc",
				tone: undefined,
				pinned: undefined,
				tagIds: [],
				includeArchived: undefined,
			});
		} catch (_) {
			toast.open("필터를 초기화하지 못했습니다");
		}
	};

	const activeToneFilter =
		activeFilters.tone === "all" ? undefined : activeFilters.tone;
	const normalizedSearch = normalizeMemoQuery(searchTerm);
	const isFiltersAtDefault =
		smartView === "all" &&
		normalizedSearch === undefined &&
		(activeFilters.sort ?? "updated_desc") === "updated_desc" &&
		activeToneFilter === undefined &&
		selectedTagFilters.length === 0;
	const selectedMemoTagIds = selectedMemo?.tags.map((tag) => tag.id) ?? [];
	const relatedMemoItems = useMemo(
		() => buildRelatedMemoItems(selectedMemo, memos),
		[selectedMemo, memos],
	);
	const smartViewCounts = useMemo(
		() =>
			getSmartViewCounts({
				memos,
				selectedMemo,
				relatedItems: relatedMemoItems,
			}),
		[memos, selectedMemo, relatedMemoItems],
	);
	const visibleMemoIds = useMemo(
		() =>
			getMemoIdsForSmartView({
				memos,
				smartView,
				selectedMemo,
				relatedItems: relatedMemoItems,
			}),
		[memos, smartView, selectedMemo, relatedMemoItems],
	);
	const visibleMemos = useMemo(() => {
		if (smartView === "related") {
			const ids = new Set(visibleMemoIds);
			return relatedMemoItems
				.map((item) => memos.find((memo) => memo.id === item.memoId))
				.filter((memo): memo is MemoRecord =>
					Boolean(memo && ids.has(memo.id)),
				);
		}
		const memoMapById = new Map(memos.map((memo) => [memo.id, memo]));
		return visibleMemoIds
			.map((id) => memoMapById.get(id))
			.filter((memo): memo is MemoRecord => Boolean(memo));
	}, [memos, visibleMemoIds, smartView, relatedMemoItems]);
	const relatedNextItems = useMemo(() => {
		const items: Array<
			{
				memo: MemoRecord;
			} & (typeof relatedMemoItems)[number]
		> = [];
		for (const item of relatedMemoItems.slice(0, 5)) {
			const memo = memoMap.get(item.memoId);
			if (!memo) {
				continue;
			}
			items.push({
				...item,
				memo,
			});
		}
		return items;
	}, [relatedMemoItems, memoMap]);
	const tagUsageCounts = useMemo(() => {
		const counts = new Map<number, number>();
		for (const memo of memos) {
			for (const tag of memo.tags) {
				counts.set(tag.id, (counts.get(tag.id) ?? 0) + 1);
			}
		}
		return counts;
	}, [memos]);
	const selectedConnectedMemos = useMemo(() => {
		if (!selectedMemo) {
			return [];
		}
		return selectedMemo.connected_ids
			.map((id) => brainMemoMap.get(id))
			.filter((memo): memo is MemoRecord => Boolean(memo));
	}, [selectedMemo, brainMemoMap]);
	const activeSecondarySmartView = secondarySmartViews.includes(smartView)
		? smartView
		: null;
	const isSelectedConnected =
		Boolean(brainCenterMemo && selectedMemo) &&
		brainCenterMemo?.id !== selectedMemo?.id &&
		brainCenterMemo?.connected_ids.includes(selectedMemo.id);
	const selectedConnectionStatus = !selectedMemo
		? "선택 없음"
		: brainCenterMemo && selectedMemo.id === brainCenterMemo.id
			? "중심 노트"
			: isSelectedConnected
				? "연결됨"
				: "연결 안 됨";
	const currentConnection = useMemo(() => {
		if (
			!brainCenterMemo ||
			!selectedMemo ||
			brainCenterMemo.id === selectedMemo.id
		) {
			return null;
		}
		return (
			brainCenterMemo.connections.find(
				(connection) => connection.memo_id === selectedMemo.id,
			) ?? null
		);
	}, [brainCenterMemo, selectedMemo]);
	const atlasMemos = useMemo(() => {
		const ordered = [brainCenterMemo, selectedMemo, ...visibleMemos].filter(
			(memo): memo is MemoRecord => Boolean(memo),
		);
		const seen = new Set<number>();
		return ordered.filter((memo) => {
			if (seen.has(memo.id)) {
				return false;
			}
			seen.add(memo.id);
			return true;
		});
	}, [brainCenterMemo, selectedMemo, visibleMemos]);

	useEffect(() => {
		if (!selectedMemo) {
			setDraftYarnColor("neutral");
			return;
		}
		if (!brainCenterMemo || brainCenterMemo.id === selectedMemo.id) {
			setDraftYarnColor(selectedMemo.tone);
			return;
		}
		setDraftYarnColor(currentConnection?.yarn_color ?? selectedMemo.tone);
	}, [brainCenterMemo, currentConnection?.yarn_color, selectedMemo]);

	return (
		<div
			className="relative flex h-[100dvh] min-h-[100dvh] flex-col overflow-hidden bg-[var(--canvas)]"
			data-testid="memo-page-root"
			data-memo-theme={designVariant}
		>
			<main className="flex-1 min-h-0">
				<BrainHome
					memos={atlasMemos}
					centerMemo={brainCenterMemo}
					selectedMemoId={selectedMemoId}
					designVariant={designVariant}
					workspaceLabel={user?.username ?? "메모판"}
					globalSearchValue={searchTerm}
					onGlobalSearchChange={handleSearchChange}
					onClearGlobalSearch={clearSearch}
					filtersBadgeLabel={
						activeSecondarySmartView
							? smartViewLabels[activeSecondarySmartView]
							: null
					}
					onOpenOrganizeTags={() => openOrganizeHub("tags")}
					onOpenOrganizeFilters={() => openOrganizeHub("filters")}
					onDownload={handleDownloadClick}
					onLogout={handleLogout}
					onPersistBrainPosition={handleSetBrainPosition}
					onSelectMemo={handleSelectMemo}
					onCenterMemoChange={setBrainCenterId}
					onCreateMemo={() => void handleCreateMemo()}
					selectedEditorContent={
						selectedMemo ? (
							<EditorPane
								memo={selectedMemo}
								centerMemo={brainCenterMemo}
								selectedConnectionStatus={selectedConnectionStatus}
								isSelectedConnected={Boolean(isSelectedConnected)}
								yarnColor={draftYarnColor}
								onYarnColorChange={handleSetConnectionStyle}
								onCenterSelected={handleCenterSelectedMemo}
								onConnectSelected={handleConnectSelectedMemo}
								onDisconnectSelected={handleDisconnectSelectedMemo}
								onOpenSelected={() => handleOpenMemo(selectedMemo.id)}
								onOpenConnectedMemo={handleOpenMemo}
								tags={tags}
								titleDraft={titleDraft}
								onTitleChange={setTitleDraft}
								onTitleCommit={commitTitle}
								editorText={editorText}
								onEditorChange={handleEditorChange}
								onDelete={handleDeleteMemo}
								onTogglePinned={handleTogglePinned}
								onToneChange={handleToneChange}
								onPinColorChange={handlePinColorChange}
								saveState={saveState}
								tagInput={tagInput}
								onTagInputChange={setTagInput}
								onCreateTag={handleCreateTag}
								onToggleTag={handleMemoTagToggle}
								selectedMemoTagIds={selectedMemoTagIds}
								connectedMemos={selectedConnectedMemos}
								mode="desktop"
								designVariant={designVariant}
								mobilePinControlHidden={false}
								onToggleMobilePinControlHidden={() => {}}
								sheetSnap="mid"
								onSetSheetSnap={() => {}}
								onRequestClose={() => {}}
							/>
						) : null
					}
					isSelectedConnected={Boolean(isSelectedConnected)}
					onConnectSelected={handleConnectSelectedMemo}
					onDisconnectSelected={handleDisconnectSelectedMemo}
				/>
			</main>

			{isOrganizeOpen ? (
				<>
					<button
						type="button"
						onClick={closeOrganizeHub}
						className="fixed inset-0 z-40 bg-black/25 backdrop-blur-sm lg:hidden"
						data-testid="memo-organize-backdrop"
					/>
					<div className="fixed inset-x-0 bottom-0 z-50 lg:hidden">
						<div
							className="mx-auto flex h-[82dvh] max-h-[100dvh] max-w-3xl flex-col overflow-hidden rounded-t-[var(--memo-radius-panel)] border border-[var(--memo-workbench-line)] bg-[var(--memo-workbench-panel)] pb-[env(safe-area-inset-bottom)] shadow-[var(--memo-shadow-panel)]"
							data-testid="memo-organize-hub-mobile"
						>
							<OrganizeHub
								mode="mobile-sheet"
								designVariant={designVariant}
								tab={organizeTab}
								onTabChange={setOrganizeTab}
								onClose={closeOrganizeHub}
								tags={tags}
								tagUsageCounts={tagUsageCounts}
								selectedTagFilters={selectedTagFilters}
								onToggleTagFilter={toggleTagFilter}
								onCreateTag={handleCreateTagFromOrganize}
								onRenameTag={handleRenameTagFromOrganize}
								onDeleteTag={handleDeleteTagFromOrganize}
								tagInput={organizeTagInput}
								onTagInputChange={setOrganizeTagInput}
								selectedMemo={selectedMemo}
								memos={brainMemos}
								onConnectMemo={handleConnectMemo}
								onDisconnectMemo={handleDisconnectMemo}
								onPersistBrainPosition={handleSetBrainPosition}
								onOpenMemo={handleOpenMemo}
								brainChromeDensity={brainChromeDensity}
								smartView={smartView}
								smartViewCounts={smartViewCounts}
								onSmartViewChange={handleSmartViewChange}
								sortValue={activeFilters.sort ?? "updated_desc"}
								onSortChange={handleSortChange}
								toneFilter={activeToneFilter}
								onToneFilterChange={handleToneFilterChange}
								filterAccordion={filterAccordion}
								onToggleFilterAccordion={toggleFilterAccordion}
								onResetFilters={() => void handleResetFilters()}
								isFiltersAtDefault={isFiltersAtDefault}
							/>
						</div>
					</div>

					<div
						className="fixed bottom-4 z-40 hidden w-[340px] lg:block"
						style={{
							top: "max(env(safe-area-inset-top), 1rem)",
							right: "max(env(safe-area-inset-right), 1rem)",
						}}
					>
						<div
							className="flex h-full flex-col overflow-hidden rounded-[var(--memo-radius-panel)] border border-[var(--memo-workbench-line)] bg-[var(--memo-workbench-panel)] shadow-[var(--memo-shadow-panel)]"
							data-testid="memo-organize-hub-desktop"
						>
							<OrganizeHub
								mode="desktop"
								designVariant={designVariant}
								tab={organizeTab}
								onTabChange={setOrganizeTab}
								onClose={closeOrganizeHub}
								tags={tags}
								tagUsageCounts={tagUsageCounts}
								selectedTagFilters={selectedTagFilters}
								onToggleTagFilter={toggleTagFilter}
								onCreateTag={handleCreateTagFromOrganize}
								onRenameTag={handleRenameTagFromOrganize}
								onDeleteTag={handleDeleteTagFromOrganize}
								tagInput={organizeTagInput}
								onTagInputChange={setOrganizeTagInput}
								selectedMemo={selectedMemo}
								memos={brainMemos}
								onConnectMemo={handleConnectMemo}
								onDisconnectMemo={handleDisconnectMemo}
								onPersistBrainPosition={handleSetBrainPosition}
								onOpenMemo={handleOpenMemo}
								brainChromeDensity={brainChromeDensity}
								smartView={smartView}
								smartViewCounts={smartViewCounts}
								onSmartViewChange={handleSmartViewChange}
								sortValue={activeFilters.sort ?? "updated_desc"}
								onSortChange={handleSortChange}
								toneFilter={activeToneFilter}
								onToneFilterChange={handleToneFilterChange}
								filterAccordion={filterAccordion}
								onToggleFilterAccordion={toggleFilterAccordion}
								onResetFilters={() => void handleResetFilters()}
								isFiltersAtDefault={isFiltersAtDefault}
							/>
						</div>
					</div>
				</>
			) : null}

			{selectedMemo && isMobileEditorOpen ? (
				<>
					<button
						type="button"
						onClick={closeMobileEditor}
						className="fixed inset-0 z-40 bg-black/25 backdrop-blur-sm lg:hidden"
						data-testid="memo-sheet-backdrop"
					/>
					<div className="fixed inset-x-0 bottom-0 z-50 lg:hidden">
						<div
							className="mx-auto flex max-h-[100dvh] max-w-3xl flex-col overflow-hidden rounded-t-[var(--memo-radius-panel)] border border-[var(--memo-workbench-line)] bg-[var(--memo-workbench-panel)] pb-[env(safe-area-inset-bottom)] shadow-[var(--memo-shadow-panel)] will-change-[height]"
							style={{
								height:
									isMobileSheetDragging && mobileSheetDragHeightPx !== null
										? `${mobileSheetDragHeightPx}px`
										: `${mobileSheetSnapHeights[mobileSheetSnap]}dvh`,
								transition: isMobileSheetDragging
									? "none"
									: "height 180ms ease",
							}}
							data-testid="memo-mobile-editor-sheet"
							data-sheet-snap={mobileSheetSnap}
							data-sheet-resolved={
								isMobileSheetDragging && mobileSheetResolvedState
									? mobileSheetResolvedState
									: undefined
							}
						>
							<div className="flex justify-center pt-2">
								<button
									type="button"
									className="h-6 w-16 touch-none rounded-[var(--memo-radius-chip)] p-0 focus:outline-none focus-visible:ring-4 focus-visible:ring-[var(--focus-ring)]"
									onPointerDown={handleSheetDragStart}
									onPointerMove={handleSheetDragMove}
									onPointerUp={handleSheetDragEnd}
									onPointerCancel={handleSheetDragCancel}
									data-testid="memo-sheet-drag-handle"
									aria-label="시트 손잡이 드래그"
								>
									<span className="mx-auto block h-1.5 w-12 rounded-[var(--memo-radius-chip)] bg-[var(--border-strong)]" />
								</button>
							</div>
							{brainCenterMemo && selectedMemo.id !== brainCenterMemo.id && (
								<div className="flex items-center justify-between gap-2 border-b border-[var(--memo-workbench-line)] px-4 py-2">
									<span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--text-secondary)]">
										{isSelectedConnected ? "연결됨" : "연결 안 됨"}
									</span>
									<button
										type="button"
										onClick={isSelectedConnected ? handleDisconnectSelectedMemo : handleConnectSelectedMemo}
										className={cn(
											"inline-flex min-h-8 items-center rounded-[var(--memo-radius-chip)] px-3 text-[11px] font-semibold uppercase tracking-[0.1em] transition focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]",
											isSelectedConnected
												? "border border-[#d58b98] bg-[#fff3f6] text-[#8e3044]"
												: "border border-[#16365f] bg-[#16365f] text-white",
										)}
										data-testid={isSelectedConnected ? "memo-sheet-disconnect" : "memo-sheet-connect"}
									>
										{isSelectedConnected ? "실 풀기" : "연결하기"}
									</button>
								</div>
							)}
							<EditorPane
								memo={selectedMemo}
								centerMemo={brainCenterMemo}
								selectedConnectionStatus={selectedConnectionStatus}
								isSelectedConnected={Boolean(isSelectedConnected)}
								yarnColor={draftYarnColor}
								onYarnColorChange={handleSetConnectionStyle}
								onCenterSelected={handleCenterSelectedMemo}
								onConnectSelected={handleConnectSelectedMemo}
								onDisconnectSelected={handleDisconnectSelectedMemo}
								onOpenSelected={() => handleOpenMemo(selectedMemo.id)}
								onOpenConnectedMemo={handleOpenMemo}
								tags={tags}
								titleDraft={titleDraft}
								onTitleChange={setTitleDraft}
								onTitleCommit={commitTitle}
								editorText={editorText}
								onEditorChange={handleEditorChange}
								onDelete={handleDeleteMemo}
								onTogglePinned={handleTogglePinned}
								onToneChange={handleToneChange}
								onPinColorChange={handlePinColorChange}
								saveState={saveState}
								tagInput={tagInput}
								onTagInputChange={setTagInput}
								onCreateTag={handleCreateTag}
								onToggleTag={handleMemoTagToggle}
								selectedMemoTagIds={selectedMemoTagIds}
								connectedMemos={selectedConnectedMemos}
								mode="mobile-sheet"
								designVariant={designVariant}
								mobilePinControlHidden={mobilePinControlHidden}
								onToggleMobilePinControlHidden={toggleMobilePinControlHidden}
								sheetSnap={mobileSheetSnap}
								onSetSheetSnap={handleSetMobileSheetSnap}
								onRequestClose={closeMobileEditor}
							/>
						</div>
					</div>
				</>
			) : null}
		</div>
	);
}

function useBrainCanvasScene({
	memos,
	activeCenterMemo,
	nodeLimit,
	searchTerm,
	selectedNodeId,
	setSelectedNodeId,
	viewport,
	setViewport,
	onPersistBrainPosition,
	designVariant,
	settleToken,
}: {
	memos: MemoRecord[];
	activeCenterMemo: MemoRecord | null;
	nodeLimit: number;
	searchTerm: string;
	selectedNodeId: number | null;
	setSelectedNodeId: (memoId: number | null) => void;
	viewport: BrainViewportState;
	setViewport: Dispatch<SetStateAction<BrainViewportState>>;
	onPersistBrainPosition: (payload: {
		id: number;
		x: number | null;
		y: number | null;
	}) => void;
	designVariant: MemoDesignVariant;
	settleToken?: number;
}) {
	const memoMap = useMemo(() => {
		const next = new Map<number, MemoRecord>();
		for (const memo of memos) {
			next.set(memo.id, memo);
		}
		return next;
	}, [memos]);

	const canvasRef = useRef<HTMLCanvasElement | null>(null);
	const interactionRef = useRef<BrainCanvasInteractionState>({
		nodes: [],
		edges: [],
	});
	const pointerStateRef = useRef<{
		pointerId: number | null;
		pointerType: string;
		target: BrainPointerTarget | null;
		nodeId: number | null;
		nodeOffsetX: number;
		nodeOffsetY: number;
		nodeWidth: number;
		nodeHeight: number;
		startX: number;
		startY: number;
		originPanX: number;
		originPanY: number;
		moved: boolean;
	}>({
		pointerId: null,
		pointerType: "mouse",
		target: null,
		nodeId: null,
		nodeOffsetX: 0,
		nodeOffsetY: 0,
		nodeWidth: 0,
		nodeHeight: 0,
		startX: 0,
		startY: 0,
		originPanX: 0,
		originPanY: 0,
		moved: false,
	});
	const [hoveredNodeId, setHoveredNodeId] = useState<number | null>(null);
	const [positionOverrides, setPositionOverrides] = useState<
		Map<number, BrainStoredPosition | null>
	>(new Map());

	const projectedGraph = useMemo(
		() =>
			projectBrainGraph({
				centerMemo: activeCenterMemo,
				memos,
				nodeLimit,
				searchQuery: searchTerm,
			}),
		[activeCenterMemo, memos, nodeLimit, searchTerm],
	);
	const visibleMemoNodeIds = useMemo(
		() =>
			new Set(
				projectedGraph.nodes
					.filter((node) => node.memoId !== null)
					.map((node) => node.memoId as number),
			),
		[projectedGraph.nodes],
	);
	const resetSceneToken = `${activeCenterMemo?.id ?? "none"}:${searchTerm}`;

	useEffect(() => {
		void resetSceneToken;
		setPositionOverrides(new Map());
		setHoveredNodeId(null);
	}, [resetSceneToken]);

	useEffect(() => {
		if (!activeCenterMemo) {
			setSelectedNodeId(null);
			return;
		}
		if (selectedNodeId !== null && visibleMemoNodeIds.has(selectedNodeId)) {
			return;
		}
		setSelectedNodeId(activeCenterMemo.id);
	}, [activeCenterMemo, selectedNodeId, setSelectedNodeId, visibleMemoNodeIds]);

	const selectedGraphMemo =
		selectedNodeId !== null ? (memoMap.get(selectedNodeId) ?? null) : null;
	const isSelectedConnected =
		selectedGraphMemo && activeCenterMemo
			? activeCenterMemo.connected_ids.includes(selectedGraphMemo.id)
			: false;
	const selectedConnectionStatus = selectedGraphMemo
		? activeCenterMemo && selectedGraphMemo.id === activeCenterMemo.id
			? "중심 노트"
			: isSelectedConnected
				? "연결됨"
				: "연결 안 됨"
		: "선택 없음";
	const highlightedRelationshipMemoId =
		activeCenterMemo &&
		hoveredNodeId !== null &&
		hoveredNodeId !== activeCenterMemo.id &&
		activeCenterMemo.connected_ids.includes(hoveredNodeId)
			? hoveredNodeId
			: isSelectedConnected
				? (selectedGraphMemo?.id ?? null)
				: null;

	useBrainCanvasRenderer({
		canvasRef,
		projectedGraph,
		selectedNodeId,
		centerMemoId: activeCenterMemo?.id ?? null,
		viewport,
		interactionRef,
		hoveredMemoId: hoveredNodeId,
		highlightedMemoId: highlightedRelationshipMemoId,
		visualMode: designVariant,
		settleToken,
		positionOverrides,
	});

	const updateHoveredNodeFromCoordinates = useCallback(
		(px: number, py: number) => {
			const canvas = canvasRef.current;
			const nodeHit = findMemoNodeHit(interactionRef.current, px, py);
			if (hasMemoHit(nodeHit)) {
				setHoveredNodeId(nodeHit.memoId);
				if (canvas) {
					canvas.style.cursor = "grab";
				}
				return;
			}
			setHoveredNodeId(null);
			if (canvas) {
				const pointerState = pointerStateRef.current;
				canvas.style.cursor =
					pointerState.pointerId !== null && pointerState.moved
						? "grabbing"
						: "grab";
			}
		},
		[],
	);

	const hitGraphAtPoint = useCallback(
		(px: number, py: number) => {
			const nodeHit = findMemoNodeHit(interactionRef.current, px, py);
			if (hasMemoHit(nodeHit) && activeCenterMemo) {
				setSelectedNodeId(nodeHit.memoId);
			}
			return;
		},
		[activeCenterMemo, setSelectedNodeId],
	);

	const handleCanvasPointerDown = (
		event: ReactPointerEvent<HTMLCanvasElement>,
	) => {
		const rect = event.currentTarget.getBoundingClientRect();
		const px = event.clientX - rect.left;
		const py = event.clientY - rect.top;
		const metrics = resolveBrainCanvasMetrics(rect.width, rect.height);
		const local = toBrainCanvasLocalPoint(metrics, viewport, px, py);
		const nodeHit = findMemoNodeHit(interactionRef.current, px, py);
		const isNodeDrag = hasMemoHit(nodeHit);
		pointerStateRef.current = {
			pointerId: event.pointerId,
			pointerType: event.pointerType,
			target: isNodeDrag ? "node" : "pan",
			nodeId: isNodeDrag ? nodeHit.memoId : null,
			nodeOffsetX: isNodeDrag ? local.x - nodeHit.layoutX : 0,
			nodeOffsetY: isNodeDrag ? local.y - nodeHit.layoutY : 0,
			nodeWidth: isNodeDrag ? nodeHit.layoutWidth : 0,
			nodeHeight: isNodeDrag ? nodeHit.layoutHeight : 0,
			startX: event.clientX,
			startY: event.clientY,
			originPanX: viewport.panX,
			originPanY: viewport.panY,
			moved: false,
		};
		if (hasMemoHit(nodeHit) && event.pointerType !== "touch") {
			setSelectedNodeId(nodeHit.memoId);
		}
		event.currentTarget.style.cursor = isNodeDrag ? "grabbing" : "grab";
		event.currentTarget.setPointerCapture(event.pointerId);
	};

	const handleCanvasPointerMove = (
		event: ReactPointerEvent<HTMLCanvasElement>,
	) => {
		if (pointerStateRef.current.pointerId !== event.pointerId) {
			if (event.pointerType === "mouse") {
				const rect = event.currentTarget.getBoundingClientRect();
				updateHoveredNodeFromCoordinates(
					event.clientX - rect.left,
					event.clientY - rect.top,
				);
			}
			return;
		}
		const pointerState = pointerStateRef.current;
		const dx = event.clientX - pointerState.startX;
		const dy = event.clientY - pointerState.startY;
		const moveThreshold = pointerState.pointerType === "touch" ? 12 : 4;
		if (Math.abs(dx) > moveThreshold || Math.abs(dy) > moveThreshold) {
			pointerState.moved = true;
		}
		if (!pointerState.moved) {
			return;
		}
		if (pointerState.target === "pan") {
			event.currentTarget.style.cursor = "grabbing";
			setViewport((previous) => ({
				...previous,
				panX: pointerState.originPanX + dx,
				panY: pointerState.originPanY + dy,
			}));
			return;
		}
		if (pointerState.target !== "node" || pointerState.nodeId === null) {
			return;
		}
		const rect = event.currentTarget.getBoundingClientRect();
		const metrics = resolveBrainCanvasMetrics(rect.width, rect.height);
		const local = toBrainCanvasLocalPoint(
			metrics,
			viewport,
			event.clientX - rect.left,
			event.clientY - rect.top,
		);
		const x = Math.max(
			pointerState.nodeWidth / 2 + 8,
			Math.min(
				metrics.contentWidth - pointerState.nodeWidth / 2 - 8,
				local.x - pointerState.nodeOffsetX,
			),
		);
		const y = Math.max(
			pointerState.nodeHeight / 2 + 8,
			Math.min(
				metrics.contentHeight - pointerState.nodeHeight / 2 - 8,
				local.y - pointerState.nodeOffsetY,
			),
		);
		const nextPosition = clampBrainStoredPosition({
			x: x / metrics.contentWidth,
			y: y / metrics.contentHeight,
		});
		setHoveredNodeId(pointerState.nodeId);
		setPositionOverrides((previous) => {
			const next = new Map(previous);
			next.set(pointerState.nodeId as number, nextPosition);
			return next;
		});
		event.currentTarget.style.cursor = "grabbing";
	};

	const handleCanvasPointerUp = (
		event: ReactPointerEvent<HTMLCanvasElement>,
	) => {
		if (pointerStateRef.current.pointerId !== event.pointerId) {
			return;
		}
		if (event.currentTarget.hasPointerCapture(event.pointerId)) {
			event.currentTarget.releasePointerCapture(event.pointerId);
		}
		const pointerState = { ...pointerStateRef.current };
		pointerStateRef.current.pointerId = null;
		pointerStateRef.current.target = null;
		pointerStateRef.current.nodeId = null;
		pointerStateRef.current.moved = false;
		if (
			pointerState.target === "node" &&
			pointerState.nodeId !== null &&
			pointerState.moved
		) {
			const override = positionOverrides.get(pointerState.nodeId);
			if (override) {
				onPersistBrainPosition({
					id: pointerState.nodeId,
					x: override.x,
					y: override.y,
				});
			}
			setPositionOverrides((previous) => {
				const next = new Map(previous);
				next.delete(pointerState.nodeId as number);
				return next;
			});
			const rect = event.currentTarget.getBoundingClientRect();
			updateHoveredNodeFromCoordinates(
				event.clientX - rect.left,
				event.clientY - rect.top,
			);
			return;
		}
		if (!pointerState.moved) {
			const rect = event.currentTarget.getBoundingClientRect();
			hitGraphAtPoint(event.clientX - rect.left, event.clientY - rect.top);
			return;
		}
		const rect = event.currentTarget.getBoundingClientRect();
		updateHoveredNodeFromCoordinates(
			event.clientX - rect.left,
			event.clientY - rect.top,
		);
	};

	const handleCanvasPointerCancel = (
		event: ReactPointerEvent<HTMLCanvasElement>,
	) => {
		if (event.currentTarget.hasPointerCapture(event.pointerId)) {
			event.currentTarget.releasePointerCapture(event.pointerId);
		}
		const nodeId = pointerStateRef.current.nodeId;
		if (nodeId !== null) {
			setPositionOverrides((previous) => {
				const next = new Map(previous);
				next.delete(nodeId);
				return next;
			});
		}
		pointerStateRef.current.pointerId = null;
		pointerStateRef.current.target = null;
		pointerStateRef.current.nodeId = null;
		pointerStateRef.current.moved = false;
		setHoveredNodeId(null);
		event.currentTarget.style.cursor = "grab";
	};

	const handleCanvasWheel = (event: ReactWheelEvent<HTMLCanvasElement>) => {
		event.preventDefault();
		const nextZoom = clampBrainZoom(
			viewport.zoom * (event.deltaY < 0 ? 1.08 : 0.92),
		);
		setViewport((previous) => ({
			...previous,
			zoom: nextZoom,
		}));
	};

	const handleCanvasLeave = () => {
		if (pointerStateRef.current.pointerId !== null) {
			return;
		}
		setHoveredNodeId(null);
		if (canvasRef.current) {
			canvasRef.current.style.cursor = "grab";
		}
	};

	return {
		canvasRef,
		projectedGraph,
		selectedGraphMemo,
		selectedConnectionStatus,
		isSelectedConnected,
		visibleMemoNodeIds,
		hoveredNodeId,
		interactionMode: "navigate",
		handleCanvasPointerDown,
		handleCanvasPointerMove,
		handleCanvasPointerUp,
		handleCanvasPointerCancel,
		handleCanvasWheel,
		handleCanvasLeave,
		setHoveredNodeId,
		selectNodeById: setSelectedNodeId,
	};
}

function BrainActionButton({
	label,
	onClick,
	disabled,
	testId,
	tone = "neutral",
	compact = false,
}: {
	label: string;
	onClick: () => void;
	disabled?: boolean;
	testId?: string;
	tone?: "neutral" | "primary" | "danger";
	compact?: boolean;
}) {
	return (
		<button
			type="button"
			onClick={onClick}
			disabled={disabled}
			data-testid={testId}
			className={cn(
				"inline-flex items-center justify-center rounded-[var(--memo-radius-control)] border font-semibold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] disabled:cursor-not-allowed disabled:opacity-45",
				compact ? "min-h-9 px-3 text-[12px]" : "min-h-10 px-3.5 text-[12px]",
				tone === "primary"
					? "border-[#16365f] bg-[#16365f] text-white hover:brightness-110"
					: tone === "danger"
						? "border-[#d58b98] bg-[#fff3f6] text-[#8e3044] hover:border-[#b35d6d]"
						: "border-[var(--memo-workbench-line)] bg-[var(--memo-workbench-panel)] text-[#203146] hover:border-[#8ea0bd]",
			)}
		>
			{label}
		</button>
	);
}

function BrainSelectionActions({
	selectedGraphMemo,
	centerMemo,
	isSelectedConnected,
	onCenterSelected,
	onOpenSelected,
	onConnectSelected,
	onDisconnectSelected,
	compact = false,
}: {
	selectedGraphMemo: MemoRecord | null;
	centerMemo: MemoRecord | null;
	isSelectedConnected: boolean;
	onCenterSelected: () => void;
	onOpenSelected: () => void;
	onConnectSelected: () => void;
	onDisconnectSelected: () => void;
	compact?: boolean;
}) {
	const canCenter =
		Boolean(selectedGraphMemo) &&
		Boolean(centerMemo) &&
		selectedGraphMemo?.id !== centerMemo?.id;
	const canToggleConnection =
		Boolean(selectedGraphMemo) &&
		Boolean(centerMemo) &&
		selectedGraphMemo?.id !== centerMemo?.id;

	return (
		<div className={cn("flex flex-wrap gap-2", compact && "gap-1.5")}>
			<BrainActionButton
				label="열기"
				onClick={onOpenSelected}
				disabled={!selectedGraphMemo}
				testId="memo-brain-open-selected"
				tone="neutral"
				compact={compact}
			/>
			<BrainActionButton
				label="중심 이동"
				onClick={onCenterSelected}
				disabled={!canCenter}
				testId="memo-brain-center-selected"
				tone="neutral"
				compact={compact}
			/>
			<BrainActionButton
				label={isSelectedConnected ? "해제" : "연결"}
				onClick={isSelectedConnected ? onDisconnectSelected : onConnectSelected}
				disabled={!canToggleConnection}
				testId={
					isSelectedConnected
						? "memo-brain-disconnect-selected"
						: "memo-brain-connect-selected"
				}
				tone={isSelectedConnected ? "danger" : "primary"}
				compact={compact}
			/>
		</div>
	);
}

function BrainVisibleNodeList({
	nodes,
	selectedNodeId,
	selectNodeById,
	className,
}: {
	nodes: BrainGraphProjection["nodes"];
	selectedNodeId: number | null;
	selectNodeById: (memoId: number) => void;
	className?: string;
}) {
	return (
		<ul
			className={cn("grid gap-2", className)}
			data-testid="memo-brain-a11y-list"
		>
			{nodes.map((node) => {
				const active = selectedNodeId === node.memoId;
				return (
					<li key={`brain-node-${node.id}`}>
						<button
							type="button"
							onClick={() => {
								if (!node.memoId) {
									return;
								}
								selectNodeById(node.memoId);
							}}
							className={cn(
								"flex w-full items-center justify-between rounded-[var(--memo-radius-control)] border px-3 py-2.5 text-left text-sm transition focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]",
								active
									? "border-[#16365f] bg-[#16365f] text-white"
									: "border-[var(--memo-workbench-line)] bg-[var(--memo-workbench-panel)] text-[#31445a] hover:border-[#93a4c0]",
							)}
						>
							<span className="line-clamp-1">{node.title}</span>
							<span
								className={cn(
									"rounded-[var(--memo-radius-chip)] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em]",
									active
										? "bg-white/18 text-white"
										: node.kind === "center"
											? "bg-[#f5ead0] text-[#86652b]"
											: node.kind === "candidate"
												? "bg-[#edf1f6] text-[#75849a]"
												: "bg-[#edf3fb] text-[#506a90]",
								)}
							>
								{node.kind === "center"
									? "중심"
									: node.kind === "candidate"
										? "후보"
										: "연결됨"}
							</span>
						</button>
					</li>
				);
			})}
		</ul>
	);
}

function BrainHome({
	memos,
	centerMemo,
	selectedMemoId,
	designVariant,
	workspaceLabel,
	globalSearchValue,
	onGlobalSearchChange,
	onClearGlobalSearch,
	filtersBadgeLabel,
	onOpenOrganizeTags,
	onOpenOrganizeFilters,
	onDownload,
	onLogout,
	onPersistBrainPosition,
	onSelectMemo,
	onCenterMemoChange,
	onCreateMemo,
	selectedEditorContent,
	isSelectedConnected: isSelectedConnectedProp = false,
	onConnectSelected,
	onDisconnectSelected,
}: {
	memos: MemoRecord[];
	centerMemo: MemoRecord | null;
	selectedMemoId: number | null;
	designVariant: MemoDesignVariant;
	workspaceLabel: string;
	globalSearchValue: string;
	onGlobalSearchChange: (value: string) => void;
	onClearGlobalSearch: () => void;
	filtersBadgeLabel: string | null;
	onOpenOrganizeTags: () => void;
	onOpenOrganizeFilters: () => void;
	onDownload: () => void;
	onLogout: () => void;
	onPersistBrainPosition: (payload: {
		id: number;
		x: number | null;
		y: number | null;
	}) => void;
	onSelectMemo: (memoId: number) => void;
	onCenterMemoChange?: (memoId: number | null) => void;
	onCreateMemo: () => void;
	selectedEditorContent?: ReactNode;
	isSelectedConnected?: boolean;
	onConnectSelected?: () => void;
	onDisconnectSelected?: () => void;
}) {
	const [searchTerm, setSearchTerm] = useState("");
	const [graphCenterId, setGraphCenterId] = useState<number | null>(
		centerMemo?.id ?? null,
	);
	const [viewport, setViewport] =
		useState<BrainViewportState>(defaultBrainViewport);
	const [trailState, setTrailState] = useState<{
		items: BrainTrailItem[];
		index: number;
	}>({ items: [], index: 0 });
	const [isListPanelOpen, setIsListPanelOpen] = useState(false);
	const [settleToken, setSettleToken] = useState(0);
	const [isDesktopCanvas, setIsDesktopCanvas] = useState(() =>
		typeof window !== "undefined"
			? window.matchMedia("(min-width: 1024px)").matches
			: true,
	);
	const [selectedNodeScreenPoint, setSelectedNodeScreenPoint] =
		useState<BrainCanvasPoint | null>(null);
	const [selectedWindowState, setSelectedWindowState] =
		useState<BrainSelectedWindowState>({
			isOpen: true,
			position: null,
			hasManualPlacement: false,
		});
	const shellRef = useRef<HTMLDivElement | null>(null);
	const selectedWindowPointerIdRef = useRef<number | null>(null);
	const selectedWindowDragOffsetRef = useRef<FloatingWindowPoint | null>(null);

	useEffect(() => {
		const mediaQuery = window.matchMedia("(min-width: 1024px)");
		const handleMediaChange = () => {
			setIsDesktopCanvas(mediaQuery.matches);
		};
		handleMediaChange();
		mediaQuery.addEventListener("change", handleMediaChange);
		return () => {
			mediaQuery.removeEventListener("change", handleMediaChange);
		};
	}, []);

	useEffect(() => {
		if (!centerMemo) {
			if (graphCenterId === null) {
				return;
			}
			setGraphCenterId(null);
			setTrailState({ items: [], index: 0 });
			setIsListPanelOpen(false);
			setSelectedWindowState({
				isOpen: true,
				position: null,
				hasManualPlacement: false,
			});
			return;
		}
		if (graphCenterId === centerMemo.id) {
			return;
		}
		setGraphCenterId(centerMemo.id);
		setTrailState({
			items: [{ centerId: centerMemo.id, timestamp: Date.now() }],
			index: 0,
		});
		setSearchTerm("");
		setViewport(defaultBrainViewport);
		setSettleToken((previous) => previous + 1);
	}, [centerMemo, graphCenterId]);

	const memoMap = useMemo(() => {
		const next = new Map<number, MemoRecord>();
		for (const memo of memos) {
			next.set(memo.id, memo);
		}
		return next;
	}, [memos]);

	const graphCenterMemo =
		graphCenterId !== null ? (memoMap.get(graphCenterId) ?? null) : null;
	const activeCenterMemo = graphCenterMemo ?? centerMemo;
	const nodeLimit = isDesktopCanvas ? 48 : 24;

	useEffect(() => {
		onCenterMemoChange?.(activeCenterMemo?.id ?? null);
	}, [activeCenterMemo?.id, onCenterMemoChange]);

	const canGoBack = trailState.index > 0;
	const canGoForward = trailState.index < trailState.items.length - 1;

	const handleTrailBack = useCallback(() => {
		setTrailState((previous) => {
			if (previous.index <= 0) {
				return previous;
			}
			const nextIndex = previous.index - 1;
			const nextCenterId = previous.items[nextIndex]?.centerId ?? null;
			if (nextCenterId !== null) {
				setGraphCenterId(nextCenterId);
				onSelectMemo(nextCenterId);
				setViewport(defaultBrainViewport);
				setSettleToken((current) => current + 1);
			}
			return {
				...previous,
				index: nextIndex,
			};
		});
	}, [onSelectMemo]);

	const handleTrailForward = useCallback(() => {
		setTrailState((previous) => {
			if (previous.index >= previous.items.length - 1) {
				return previous;
			}
			const nextIndex = previous.index + 1;
			const nextCenterId = previous.items[nextIndex]?.centerId ?? null;
			if (nextCenterId !== null) {
				setGraphCenterId(nextCenterId);
				onSelectMemo(nextCenterId);
				setViewport(defaultBrainViewport);
				setSettleToken((current) => current + 1);
			}
			return {
				...previous,
				index: nextIndex,
			};
		});
	}, [onSelectMemo]);

	const {
		canvasRef,
		projectedGraph,
		selectedGraphMemo,
		selectedConnectionStatus,
		isSelectedConnected: isSelectedConnectedScene,
		interactionMode,
		handleCanvasPointerDown,
		handleCanvasPointerMove,
		handleCanvasPointerUp,
		handleCanvasPointerCancel,
		handleCanvasWheel,
		handleCanvasLeave,
		selectNodeById,
	} = useBrainCanvasScene({
		memos,
		activeCenterMemo,
		nodeLimit,
		searchTerm,
		selectedNodeId: selectedMemoId,
		setSelectedNodeId: (memoId) => {
			if (typeof memoId === "number") {
				onSelectMemo(memoId);
			}
		},
		viewport,
		setViewport,
		onPersistBrainPosition,
		designVariant,
		settleToken,
	});
	const selectedNodeSyncToken = `${selectedMemoId ?? "none"}:${viewport.panX}:${viewport.panY}:${viewport.zoom}:${projectedGraph.nodes.length}:${settleToken}`;

	useEffect(() => {
		void selectedNodeSyncToken;
		const frame = window.requestAnimationFrame(() => {
			const canvas = canvasRef.current;
			if (!canvas) {
				setSelectedNodeScreenPoint(null);
				return;
			}
			const x = Number(canvas.dataset.selectedNodeScreenX);
			const y = Number(canvas.dataset.selectedNodeScreenY);
			if (Number.isFinite(x) && Number.isFinite(y)) {
				setSelectedNodeScreenPoint({ x, y });
				return;
			}
			setSelectedNodeScreenPoint(null);
		});
		return () => {
			window.cancelAnimationFrame(frame);
		};
	}, [canvasRef, selectedNodeSyncToken]);

	const listPanelNodes = projectedGraph.nodes
		.filter((node) => node.memoId !== null)
		.slice(0, 14);
	const commandButtonClass =
		"inline-flex h-10 items-center rounded-[1rem_1.15rem_0.95rem_1.2rem] border border-[var(--memo-workbench-line)] bg-[linear-gradient(180deg,rgba(255,253,247,0.98)_0%,rgba(255,246,232,0.94)_100%)] px-3 text-[12px] font-semibold text-[var(--text-primary)] shadow-[var(--shadow-card)] transition hover:-translate-y-0.5 hover:rotate-[1deg] hover:border-[var(--border-strong)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] disabled:cursor-not-allowed disabled:opacity-45";
	const topRailButtonClass =
		"inline-flex h-10 items-center justify-center rounded-[1rem_1.2rem_0.95rem_1.1rem] border border-[var(--memo-workbench-line)] bg-[linear-gradient(180deg,rgba(255,253,247,0.98)_0%,rgba(255,246,232,0.94)_100%)] px-3 text-[12px] font-semibold text-[var(--text-secondary)] shadow-[var(--shadow-card)] transition hover:-translate-y-0.5 hover:rotate-[-1deg] hover:border-[var(--border-strong)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]";
	const topRailPrimaryButtonClass =
		"inline-flex h-10 items-center justify-center gap-2 rounded-[1rem_1.25rem_1rem_1.2rem] bg-[linear-gradient(135deg,var(--accent)_0%,#f09982_100%)] px-3.5 text-[12px] font-semibold text-white shadow-[0_16px_32px_-24px_rgba(34,50,74,0.38)] transition hover:-translate-y-0.5 hover:rotate-[1deg] hover:brightness-105 focus:outline-none focus-visible:ring-4 focus-visible:ring-[var(--focus-ring)]";
	const globalSearchActive =
		normalizeMemoQuery(globalSearchValue) !== undefined;
	const safeTopInset = "max(env(safe-area-inset-top), 1rem)";
	const safeRightInset = "max(env(safe-area-inset-right), 1rem)";
	const safeBottomInset = "max(env(safe-area-inset-bottom), 1rem)";
	const safeLeftInset = "max(env(safe-area-inset-left), 1rem)";
	const topOverlayStyle = {
		top: safeTopInset,
		left: safeLeftInset,
		right:
			isDesktopCanvas && isListPanelOpen
				? `calc(${safeRightInset} + 19.5rem)`
				: safeRightInset,
	};
	const listPanelStyle = isDesktopCanvas
		? {
				top: `calc(${safeTopInset} + 8.5rem)`,
				right: safeRightInset,
				bottom: safeBottomInset,
			}
		: {
				left: "max(env(safe-area-inset-left), 0.75rem)",
				right: "max(env(safe-area-inset-right), 0.75rem)",
				bottom: safeBottomInset,
			};
	const statusDockStyle = {
		left: safeLeftInset,
		bottom: safeBottomInset,
	};
	const shellHeight = shellRef.current?.clientHeight ?? 0;
	const shellWidth = shellRef.current?.clientWidth ?? 0;
	const selectedWindowBounds =
		shellWidth > 0 && shellHeight > 0
			? {
					width: shellWidth,
					height: shellHeight,
					margin: brainSelectedWindowMargin,
				}
			: null;
	const selectedWindowAutoPosition =
		selectedNodeScreenPoint && selectedWindowBounds
			? resolveSelectedWindowAutoPosition({
					anchor: selectedNodeScreenPoint,
					size: brainSelectedWindowSize,
					bounds: selectedWindowBounds,
				})
			: null;
	const selectedWindowPosition = selectedWindowBounds
		? selectedWindowState.hasManualPlacement && selectedWindowState.position
			? clampFloatingWindowPoint(
					selectedWindowState.position,
					brainSelectedWindowSize,
					selectedWindowBounds,
				)
			: selectedWindowAutoPosition
		: null;
	const selectedWindowSide =
		selectedWindowPosition && selectedNodeScreenPoint
			? selectedWindowPosition.x < selectedNodeScreenPoint.x
				? "left"
				: "right"
			: "right";

	const handleToggleSelectedWindow = useCallback(() => {
		setSelectedWindowState((previous) => ({
			...previous,
			isOpen: !previous.isOpen,
		}));
	}, []);

	const handleCloseSelectedWindow = useCallback(() => {
		setSelectedWindowState((previous) => ({
			...previous,
			isOpen: false,
		}));
	}, []);

	const handleSelectedWindowDragStart = useCallback(
		(event: ReactPointerEvent<HTMLDivElement>) => {
			const shell = shellRef.current;
			if (!shell || !selectedWindowPosition) {
				return;
			}
			const shellRect = shell.getBoundingClientRect();
			selectedWindowPointerIdRef.current = event.pointerId;
			selectedWindowDragOffsetRef.current = {
				x: event.clientX - shellRect.left - selectedWindowPosition.x,
				y: event.clientY - shellRect.top - selectedWindowPosition.y,
			};
			setSelectedWindowState((previous) => ({
				...previous,
				isOpen: true,
				hasManualPlacement: true,
				position: selectedWindowPosition,
			}));
			event.preventDefault();
			event.stopPropagation();
			event.currentTarget.setPointerCapture(event.pointerId);
		},
		[selectedWindowPosition],
	);

	const handleSelectedWindowDragMove = useCallback(
		(event: ReactPointerEvent<HTMLDivElement>) => {
			if (selectedWindowPointerIdRef.current !== event.pointerId) {
				return;
			}
			const shell = shellRef.current;
			const dragOffset = selectedWindowDragOffsetRef.current;
			if (!shell || !dragOffset) {
				return;
			}
			const shellRect = shell.getBoundingClientRect();
			const nextPosition = clampFloatingWindowPoint(
				{
					x: event.clientX - shellRect.left - dragOffset.x,
					y: event.clientY - shellRect.top - dragOffset.y,
				},
				brainSelectedWindowSize,
				{
					width: shellRect.width,
					height: shellRect.height,
					margin: brainSelectedWindowMargin,
				},
			);
			setSelectedWindowState((previous) => ({
				...previous,
				isOpen: true,
				hasManualPlacement: true,
				position: nextPosition,
			}));
			event.preventDefault();
			event.stopPropagation();
		},
		[],
	);

	const handleSelectedWindowDragEnd = useCallback(
		(event: ReactPointerEvent<HTMLDivElement>) => {
			if (selectedWindowPointerIdRef.current !== event.pointerId) {
				return;
			}
			if (event.currentTarget.hasPointerCapture(event.pointerId)) {
				event.currentTarget.releasePointerCapture(event.pointerId);
			}
			selectedWindowPointerIdRef.current = null;
			selectedWindowDragOffsetRef.current = null;
			event.preventDefault();
			event.stopPropagation();
		},
		[],
	);

	const handleSelectedWindowDragCancel = useCallback(
		(event: ReactPointerEvent<HTMLDivElement>) => {
			if (event.currentTarget.hasPointerCapture(event.pointerId)) {
				event.currentTarget.releasePointerCapture(event.pointerId);
			}
			selectedWindowPointerIdRef.current = null;
			selectedWindowDragOffsetRef.current = null;
			event.preventDefault();
			event.stopPropagation();
		},
		[],
	);

	return (
		<section className="relative h-full min-h-0" data-testid="memo-brain-home">
			<div
				ref={shellRef}
				className="memo-brain-shell relative h-full w-full overflow-hidden bg-[var(--canvas)]"
				data-testid="memo-brain-canvas-shell"
				data-brain-mode={designVariant}
				data-brain-interaction-mode={interactionMode}
				data-brain-zoom={viewport.zoom.toFixed(2)}
				data-memo-theme={designVariant}
				data-brain-node-shape={brainNodeShape}
			>
				<div className="pointer-events-none absolute inset-0 z-0">
					<div className="absolute inset-0 bg-[radial-gradient(circle_at_10%_12%,rgba(80,117,171,0.11),transparent_24%),radial-gradient(circle_at_84%_18%,rgba(120,146,183,0.12),transparent_20%),linear-gradient(180deg,rgba(247,249,251,0.72)_0%,rgba(233,238,244,0.94)_100%)]" />
					<div className="absolute inset-0 opacity-35 [background-image:linear-gradient(rgba(110,126,151,0.055)_1px,transparent_1px),linear-gradient(90deg,rgba(110,126,151,0.055)_1px,transparent_1px)] [background-size:28px_28px]" />
					<div className="absolute inset-x-0 top-0 h-28 border-b border-[rgba(173,184,198,0.34)] bg-[linear-gradient(180deg,rgba(255,255,255,0.5)_0%,rgba(255,255,255,0)_100%)]" />
				</div>
				<canvas
					ref={canvasRef}
					width={1280}
					height={720}
					className="brain-center-pulse relative z-[1] h-full w-full cursor-grab touch-none bg-transparent"
					onPointerDown={handleCanvasPointerDown}
					onPointerMove={handleCanvasPointerMove}
					onPointerUp={handleCanvasPointerUp}
					onPointerCancel={handleCanvasPointerCancel}
					onPointerLeave={handleCanvasLeave}
					onWheel={handleCanvasWheel}
					onDoubleClick={() => setViewport(defaultBrainViewport)}
					data-testid="memo-brain-canvas"
				/>
				<div
					className="pointer-events-none absolute z-20"
					style={topOverlayStyle}
				>
					<div className="pointer-events-auto flex flex-col gap-3">
						<div
							className="rounded-[var(--memo-radius-panel)] border border-[var(--memo-workbench-line)] bg-[var(--memo-workbench-panel)] p-3 backdrop-blur-sm"
							data-testid="memo-brain-global-rail"
						>
							<div className="flex flex-col gap-3 xl:flex-row xl:items-center">
								<div className="min-w-0 xl:w-[12rem]">
									<p className="font-[var(--font-accent)] text-[10px] uppercase tracking-[0.24em] text-[var(--text-tertiary)]">
										scrapbook atlas
									</p>
									<p className="mt-1 truncate text-base font-semibold text-[var(--text-primary)]">
										{workspaceLabel}
									</p>
								</div>
								<div className="flex min-w-0 flex-1 flex-col gap-2 xl:flex-row xl:items-center">
									<label className="relative block min-w-0 flex-1">
										<span className="sr-only">전체 메모 검색</span>
										<Icon
											name="search"
											title="검색"
											className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-tertiary)]"
										/>
										<input
											type="text"
											value={globalSearchValue}
											onChange={(event) =>
												onGlobalSearchChange(event.target.value)
											}
											placeholder="전체 메모 검색"
											className="h-10 w-full rounded-[var(--memo-radius-control)] border border-[var(--memo-workbench-line)] bg-[var(--memo-workbench-panel)] pl-10 pr-20 text-sm text-[var(--text-primary)] transition placeholder:text-[var(--text-tertiary)] hover:border-[var(--border-strong)] focus:outline-none focus-visible:border-[var(--accent)] focus-visible:ring-4 focus-visible:ring-[var(--focus-ring)]"
											data-testid="memo-global-search"
										/>
										{globalSearchActive ? (
											<button
												type="button"
												onClick={onClearGlobalSearch}
												className="absolute right-2 top-1/2 -translate-y-1/2 rounded-[var(--memo-radius-chip)] bg-[var(--memo-workbench-muted)] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--text-secondary)] transition hover:bg-[var(--accent-soft)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
											>
												지우기
											</button>
										) : null}
									</label>
									<div className="flex flex-wrap items-center gap-2">
										<button
											type="button"
											onClick={onCreateMemo}
											className={topRailPrimaryButtonClass}
											data-testid="memo-create-sticky"
										>
											<Icon
												name="file-plus"
												className="h-4 w-4"
												title="메모 만들기"
											/>
											새 메모
										</button>
										<button
											type="button"
											onClick={onOpenOrganizeTags}
											className={topRailButtonClass}
											data-testid="memo-organize-trigger"
										>
											정리함
										</button>
										<button
											type="button"
											onClick={onOpenOrganizeFilters}
											className={topRailButtonClass}
											data-testid="memo-filters-open"
										>
											필터
											{filtersBadgeLabel ? (
												<span className="ml-2 rounded-[var(--memo-radius-chip)] bg-[var(--memo-workbench-muted)] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--text-secondary)]">
													{filtersBadgeLabel}
												</span>
											) : null}
										</button>
										<Button
											icon={
												<Icon
													name="download"
													className="h-4 w-4"
													title="다운로드"
												/>
											}
											title="백업 다운로드"
											onClick={onDownload}
											className="h-10 w-10 rounded-[var(--memo-radius-control)] border-[var(--memo-workbench-line)] bg-[var(--memo-workbench-panel)] text-[var(--accent)] shadow-none hover:translate-y-0 hover:bg-[var(--memo-workbench-muted)] hover:brightness-100"
										/>
										<Button
											icon={
												<Icon
													name="log-out"
													className="h-4 w-4"
													title="로그아웃"
												/>
											}
											title="로그아웃"
											onClick={onLogout}
											className="h-10 w-10 rounded-[var(--memo-radius-control)] border-[var(--memo-workbench-line)] bg-[var(--memo-workbench-panel)] text-[var(--accent)] shadow-none hover:translate-y-0 hover:bg-[var(--memo-workbench-muted)] hover:brightness-100"
										/>
									</div>
								</div>
							</div>
						</div>

						<div
							className="rounded-[var(--memo-radius-panel)] border border-[var(--memo-workbench-line)] bg-[var(--memo-workbench-panel)] p-3 backdrop-blur-sm"
							data-testid="memo-brain-command-rail"
						>
							<div className="flex flex-wrap items-center gap-2">
								<input
									type="text"
									value={searchTerm}
									onChange={(event) => setSearchTerm(event.target.value)}
									placeholder="노트 탐색"
									className="h-10 min-w-[12rem] flex-1 rounded-[var(--memo-radius-control)] border border-[var(--memo-workbench-line)] bg-[var(--memo-workbench-panel)] px-3.5 text-sm text-[#203146] placeholder:text-[#6a7b94] focus:outline-none focus-visible:ring-4 focus-visible:ring-[var(--focus-ring)]"
									data-testid="memo-brain-search"
									disabled={!centerMemo}
								/>
								<button
									type="button"
									onClick={handleTrailBack}
									disabled={!centerMemo || !canGoBack}
									className={commandButtonClass}
									data-testid="memo-brain-back"
								>
									뒤로
								</button>
								<button
									type="button"
									onClick={handleTrailForward}
									disabled={!centerMemo || !canGoForward}
									className={commandButtonClass}
									data-testid="memo-brain-forward"
								>
									앞으로
								</button>
								<button
									type="button"
									onClick={() => setIsListPanelOpen((previous) => !previous)}
									disabled={!centerMemo || listPanelNodes.length === 0}
									className={commandButtonClass}
									data-testid="memo-brain-toggle-list-panel"
								>
									{isListPanelOpen ? "노트 닫기" : "노트 보기"}
								</button>
								{isDesktopCanvas ? (
									<button
										type="button"
										onClick={handleToggleSelectedWindow}
										disabled={!centerMemo || !selectedGraphMemo}
										className={cn(
											commandButtonClass,
											selectedWindowState.isOpen &&
												selectedGraphMemo &&
												"border-[#16365f] bg-[#16365f] text-white hover:brightness-110",
										)}
										data-testid="memo-brain-toggle-selected-panel"
									>
										선택 메모
									</button>
								) : null}
							</div>
						</div>
					</div>
				</div>

				{centerMemo ? (
					<div
						className={cn(
							"pointer-events-none absolute z-20",
							isDesktopCanvas ? "w-[min(34rem,calc(100%-24rem))]" : "inset-x-3",
						)}
						style={statusDockStyle}
					>
						<div className="pointer-events-auto flex flex-wrap items-center gap-2 rounded-[var(--memo-radius-panel)] border border-[var(--memo-workbench-line)] bg-[var(--memo-workbench-panel)] px-3 py-2 text-[#203146] backdrop-blur-sm">
							<span className="rounded-[var(--memo-radius-chip)] bg-[#eef1d7] px-2.5 py-1 text-[11px] font-semibold tracking-[0.08em] text-[#617231]">
								{selectedConnectionStatus}
							</span>
							<span className="line-clamp-1 text-sm font-semibold text-[#203146]">
								{selectedGraphMemo?.title ?? "선택된 노드 없음"}
							</span>
							<span
								className="text-[12px] text-[#62748d]"
								data-testid="memo-brain-selection-status"
							>
								보이는 연결 {projectedGraph.centerMetrics.connectedVisibleCount}{" "}
								· 후보 {projectedGraph.centerMetrics.candidateVisibleCount}
							</span>
							{(activeCenterMemo?.connected_ids.length ?? 0) === 0 ? (
								<span
									className="text-[12px] text-[#8a6c2f]"
									data-testid="memo-brain-empty-hint"
								>
									아직 연결이 없습니다. 포스트잇을 선택해 실을 이어보세요.
								</span>
							) : null}
							<span className="ml-auto text-[12px] text-[#62748d]">
								Zoom {viewport.zoom.toFixed(2)}
							</span>
						</div>
					</div>
				) : (
					<div className="pointer-events-none absolute inset-0 z-10 grid place-items-center px-6 py-10">
						<div className="pointer-events-auto w-full max-w-md rounded-[1.4rem] border border-[var(--memo-workbench-line)] bg-[rgb(251_252_253_/_0.92)] px-6 py-6 text-center shadow-[var(--memo-shadow-panel)] backdrop-blur-sm">
							<p className="font-[var(--font-accent)] text-[11px] uppercase tracking-[0.24em] text-[var(--text-tertiary)]">
								board ready
							</p>
							<p className="mt-3 text-lg font-semibold text-[var(--text-primary)]">
								아직 메모가 없습니다
							</p>
							<p className="mt-2 text-sm leading-relaxed text-[var(--text-secondary)]">
								새 포스트잇을 만들면 이 공간 전체에서 노트를 바로 탐색할 수
								있습니다.
							</p>
							<button
								type="button"
								onClick={onCreateMemo}
								className="mt-5 inline-flex h-11 items-center justify-center rounded-[var(--memo-radius-control)] bg-[var(--accent)] px-4 text-sm font-semibold text-white transition hover:brightness-110 focus:outline-none focus-visible:ring-4 focus-visible:ring-[var(--focus-ring)]"
							>
								메모 만들기
							</button>
						</div>
					</div>
				)}

				{isDesktopCanvas &&
				selectedGraphMemo &&
				selectedWindowState.isOpen &&
				selectedWindowPosition ? (
					<div
						className="pointer-events-none absolute z-20"
						style={{
							top: selectedWindowPosition.y,
							left: selectedWindowPosition.x,
						}}
					>
						<div
							className="pointer-events-auto w-[min(26rem,calc(100vw-4rem))] overflow-hidden rounded-[1.5rem] border border-[rgba(108,77,40,0.2)] bg-[rgba(255,246,219,0.92)] shadow-[0_24px_40px_-24px_rgba(78,52,24,0.38)] backdrop-blur-sm"
							data-testid="memo-brain-context-dock"
							data-side={selectedWindowSide}
						>
							<div className="flex items-start justify-between gap-3 border-b border-[rgba(109,77,43,0.14)] px-4 py-3">
								<div
									className="min-w-0 flex-1 touch-none select-none"
									onPointerDown={handleSelectedWindowDragStart}
									onPointerMove={handleSelectedWindowDragMove}
									onPointerUp={handleSelectedWindowDragEnd}
									onPointerCancel={handleSelectedWindowDragCancel}
									data-testid="memo-brain-context-dock-drag-handle"
								>
									<p className="font-[var(--font-accent)] text-[11px] uppercase tracking-[0.2em] text-[#805f34]">
										selected memo
									</p>
									<p className="mt-1 line-clamp-1 text-sm font-semibold text-[#4a321b]">
										{selectedGraphMemo.title}
									</p>
								</div>
								<div className="flex items-center gap-1.5">
									{selectedGraphMemo.id !== activeCenterMemo?.id && (
										<button
											type="button"
											onClick={isSelectedConnectedProp ? onDisconnectSelected : onConnectSelected}
											className={cn(
												"inline-flex min-h-8 items-center rounded-[var(--memo-radius-chip)] px-2 text-[11px] font-semibold uppercase tracking-[0.1em] transition focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]",
												isSelectedConnectedProp
													? "border border-[#d58b98] bg-[#fff3f6] text-[#8e3044] hover:border-[#b35d6d]"
													: "border border-[#16365f] bg-[#16365f] text-white hover:brightness-110",
											)}
											data-testid={isSelectedConnectedProp ? "memo-brain-dock-disconnect" : "memo-brain-dock-connect"}
										>
											{isSelectedConnectedProp ? "실 풀기" : "연결하기"}
										</button>
									)}
									<button
										type="button"
										onClick={handleCloseSelectedWindow}
										className="inline-flex min-h-8 items-center rounded-[var(--memo-radius-chip)] border border-[rgba(109,77,43,0.16)] bg-[rgba(255,250,238,0.92)] px-2 text-[11px] font-semibold uppercase tracking-[0.1em] text-[#6a4a27] transition hover:border-[#9f7a4c] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
										data-testid="memo-brain-context-dock-close"
									>
										닫기
									</button>
								</div>
							</div>
							<div className="max-h-[70dvh] overflow-y-auto">
								{selectedEditorContent}
							</div>
						</div>
					</div>
				) : null}

				{isListPanelOpen ? (
					<div
						className={cn(
							"absolute z-20 overflow-hidden rounded-[var(--memo-radius-panel)] border border-[var(--memo-workbench-line)] bg-[var(--memo-workbench-panel)] backdrop-blur-sm",
							isDesktopCanvas
								? "w-[18.5rem]"
								: "inset-x-3 bottom-3 max-h-[43%]",
						)}
						style={listPanelStyle}
						data-testid="memo-brain-list-panel"
					>
						<div className="flex items-center justify-between border-b border-[var(--memo-workbench-line)] px-3 py-3">
							<p className="font-[var(--font-accent)] text-[11px] uppercase tracking-[0.22em] text-[#71829a]">
								note stack
							</p>
							<button
								type="button"
								onClick={() => setViewport(defaultBrainViewport)}
								className="rounded-[var(--memo-radius-chip)] px-2 py-1 text-[11px] font-medium text-[#62748d] transition hover:bg-[var(--memo-workbench-muted)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
							>
								뷰 리셋
							</button>
						</div>
						<BrainVisibleNodeList
							nodes={listPanelNodes}
							selectedNodeId={selectedMemoId}
							selectNodeById={selectNodeById}
							className="overflow-y-auto p-3"
						/>
					</div>
				) : null}
			</div>
		</section>
	);
}

function SmartViewButton({
	label,
	active,
	count,
	disabled,
	testId,
	onClick,
}: {
	label: string;
	active: boolean;
	count: number;
	disabled?: boolean;
	testId?: string;
	onClick: () => void;
}) {
	return (
		<button
			type="button"
			onClick={onClick}
			disabled={disabled}
			data-testid={testId}
			className={cn(
				"inline-flex min-h-10 items-center gap-2 rounded-[var(--memo-radius-control)] border px-3 text-xs font-semibold uppercase tracking-[0.12em] transition focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] disabled:cursor-not-allowed disabled:opacity-45",
				active
					? "border-[var(--accent)] bg-[var(--accent)] text-white"
					: "border-[var(--memo-workbench-line)] bg-[var(--memo-workbench-panel)] text-[var(--text-secondary)] hover:border-[var(--border-strong)]",
			)}
		>
			<span>{label}</span>
			<span
				className={cn(
					"inline-flex min-h-5 min-w-5 items-center justify-center rounded-[calc(var(--memo-radius-chip)+1px)] px-1.5 text-[10px] font-semibold",
					active
						? "bg-white/20 text-white"
						: "bg-[var(--memo-workbench-muted)] text-[var(--text-secondary)]",
				)}
			>
				{count}
			</span>
		</button>
	);
}

function ViewToggle({
	viewMode,
	onChange,
	density,
	onDensityChange,
}: {
	viewMode: ViewMode;
	onChange: (mode: ViewMode) => void;
	density: DensityMode;
	onDensityChange: (mode: DensityMode) => void;
}) {
	return (
		<div
			className="flex w-full flex-wrap items-center gap-2 sm:w-auto"
			data-testid="memo-view-toggle"
		>
			<div className="inline-flex h-11 w-full items-center rounded-[var(--memo-radius-control)] border border-[var(--memo-workbench-line)] bg-[var(--memo-workbench-panel)] p-1 sm:w-auto">
				<button
					type="button"
					onClick={() => onChange("list")}
					className={cn(
						"inline-flex h-9 flex-1 items-center justify-center rounded-[calc(var(--memo-radius-control)-2px)] px-3 text-xs font-semibold uppercase tracking-[0.1em] transition sm:min-w-16 sm:flex-none",
						viewMode === "list"
							? "bg-[var(--accent)] text-white"
							: "text-[var(--text-secondary)]",
					)}
				>
					List
				</button>
				<button
					type="button"
					onClick={() => onChange("gallery")}
					className={cn(
						"inline-flex h-9 flex-1 items-center justify-center rounded-[calc(var(--memo-radius-control)-2px)] px-3 text-xs font-semibold uppercase tracking-[0.1em] transition sm:min-w-16 sm:flex-none",
						viewMode === "gallery"
							? "bg-[var(--accent)] text-white"
							: "text-[var(--text-secondary)]",
					)}
				>
					Gallery
				</button>
			</div>

			<div className="inline-flex h-11 w-full items-center rounded-[var(--memo-radius-control)] border border-[var(--memo-workbench-line)] bg-[var(--memo-workbench-panel)] p-1 sm:w-auto">
				<button
					type="button"
					onClick={() => onDensityChange("compact")}
					className={cn(
						"inline-flex h-9 flex-1 items-center justify-center rounded-[calc(var(--memo-radius-control)-2px)] px-3 text-xs font-semibold uppercase tracking-[0.1em] transition sm:min-w-20 sm:flex-none",
						density === "compact"
							? "bg-[var(--accent)] text-white"
							: "text-[var(--text-secondary)]",
					)}
				>
					Compact
				</button>
				<button
					type="button"
					onClick={() => onDensityChange("comfortable")}
					className={cn(
						"inline-flex h-9 flex-1 items-center justify-center rounded-[calc(var(--memo-radius-control)-2px)] px-3 text-xs font-semibold uppercase tracking-[0.1em] transition sm:min-w-20 sm:flex-none",
						density === "comfortable"
							? "bg-[var(--accent)] text-white"
							: "text-[var(--text-secondary)]",
					)}
				>
					Cozy
				</button>
			</div>
		</div>
	);
}

function MemoCollection({
	memos,
	selectedMemoId,
	onOpenMemo,
	onCreate,
	viewMode,
	density,
}: {
	memos: MemoRecord[];
	selectedMemoId: number | null;
	onOpenMemo: (memoId: number) => void;
	onCreate: () => Promise<void>;
	viewMode: ViewMode;
	density: DensityMode;
}) {
	if (memos.length === 0) {
		return (
			<div className="grid min-h-[380px] place-items-center px-6 py-10 text-center">
				<div className="max-w-sm">
					<div className="mx-auto grid h-14 w-14 place-items-center rounded-[var(--memo-radius-control)] bg-[var(--accent)] text-white shadow-[var(--memo-shadow-rail)]">
						<Icon name="empty-state" className="h-6 w-6" title="메모 없음" />
					</div>
					<p className="mt-4 text-lg font-medium text-[var(--text-primary)]">
						메모가 아직 없어요
					</p>
					<p className="mt-2 text-sm leading-relaxed text-[var(--text-secondary)]">
						이 화면에서 첫 메모를 만들어 보세요.
					</p>
					<button
						type="button"
						onClick={() => {
							void onCreate();
						}}
						className="mt-5 inline-flex h-11 items-center justify-center rounded-[var(--memo-radius-control)] bg-[var(--accent)] px-5 text-sm font-semibold text-white transition duration-[var(--motion-fast)] hover:brightness-110 focus:outline-none focus-visible:ring-4 focus-visible:ring-[var(--focus-ring)]"
					>
						메모 만들기
					</button>
				</div>
			</div>
		);
	}

	if (viewMode === "gallery") {
		const cardHeight =
			density === "compact" ? "min-h-[168px]" : "min-h-[196px]";
		return (
			<ul
				className="grid gap-3 p-4 sm:grid-cols-2"
				data-testid="memo-collection"
			>
				{memos.map((memo) => {
					const tone = toneMeta(memo.tone);
					const selected = selectedMemoId === memo.id;
					return (
						<li key={memo.id}>
							<button
								type="button"
								onClick={() => onOpenMemo(memo.id)}
								className={cn(
									"flex w-full flex-col justify-between rounded-[var(--memo-radius-panel)] border border-[var(--memo-workbench-line)] p-4 text-left shadow-[0_1px_0_rgb(255_255_255_/_0.7)] transition duration-[var(--motion-fast)] hover:border-[var(--border-strong)]",
									tone.chipClass,
									cardHeight,
									selected &&
										"border-[var(--accent)] bg-[var(--memo-workbench-muted)] ring-1 ring-[var(--accent)]",
								)}
							>
								<div className="flex items-center justify-between gap-2">
									<p className="line-clamp-1 text-sm font-semibold">
										{memo.title}
									</p>
									{memo.is_pinned ? (
										<span className="text-[11px] font-semibold uppercase">
											고정됨
										</span>
									) : null}
								</div>
								<p className="mt-2 line-clamp-4 text-sm leading-relaxed text-[var(--text-secondary)]">
									{getMemoSnippet(memo.content)}
								</p>
								<p className="mt-3 text-xs font-medium text-[var(--text-tertiary)]">
									{formatMiniDate(memo.updated_at)}
								</p>
							</button>
						</li>
					);
				})}
			</ul>
		);
	}

	const rowHeight = density === "compact" ? "min-h-[84px]" : "min-h-[104px]";
	return (
		<ul
			className="divide-y divide-[var(--border-soft)]"
			data-testid="memo-collection"
		>
			{memos.map((memo) => {
				const selected = selectedMemoId === memo.id;
				const tone = toneMeta(memo.tone);
				return (
					<li key={memo.id}>
						<button
							type="button"
							onClick={() => onOpenMemo(memo.id)}
							className={cn(
								"w-full border-l-[3px] px-4 py-3 text-left transition duration-[var(--motion-fast)]",
								rowHeight,
								tone.accentClass,
								selected
									? "bg-[var(--memo-workbench-muted)]"
									: "bg-[transparent] hover:bg-[var(--memo-workbench-muted)]/72",
							)}
						>
							<div className="flex items-center justify-between gap-3">
								<div className="min-w-0">
									<p className="line-clamp-1 text-[15px] font-semibold text-[var(--text-primary)]">
										{memo.title}
									</p>
									<p className="mt-1 line-clamp-2 text-sm leading-relaxed text-[var(--text-secondary)]">
										{getMemoSnippet(memo.content)}
									</p>
								</div>

								<div className="shrink-0 text-right">
									<p className="text-xs font-medium text-[var(--text-tertiary)]">
										{formatMiniDate(memo.updated_at)}
									</p>
									{memo.is_pinned ? (
										<p className="mt-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--text-secondary)]">
											고정됨
										</p>
									) : null}
								</div>
							</div>

							{memo.tags.length > 0 ? (
								<div className="mt-2 flex flex-wrap gap-1.5">
									{memo.tags.slice(0, 3).map((tag) => (
										<span
											key={tag.id}
											className="inline-flex min-h-6 items-center rounded-[var(--memo-radius-chip)] border border-[var(--memo-workbench-line)] bg-[var(--memo-workbench-panel)] px-2 text-[11px] font-medium text-[var(--text-secondary)]"
										>
											#{tag.name}
										</span>
									))}
								</div>
							) : null}
						</button>
					</li>
				);
			})}
		</ul>
	);
}

function EditorPane({
	memo,
	centerMemo,
	selectedConnectionStatus = "선택 없음",
	isSelectedConnected = false,
	yarnColor = "neutral",
	onYarnColorChange,
	onCenterSelected,
	onConnectSelected,
	onDisconnectSelected,
	onOpenSelected,
	onOpenConnectedMemo,
	tags,
	titleDraft,
	onTitleChange,
	onTitleCommit,
	editorText,
	onEditorChange,
	onDelete,
	onTogglePinned,
	onToneChange,
	onPinColorChange,
	saveState,
	tagInput,
	onTagInputChange,
	onCreateTag,
	onToggleTag,
	selectedMemoTagIds,
	connectedMemos,
	mode,
	designVariant,
	mobilePinControlHidden,
	onToggleMobilePinControlHidden,
	sheetSnap,
	onSetSheetSnap,
	onRequestClose,
}: {
	memo: MemoRecord | null;
	centerMemo?: MemoRecord | null;
	selectedConnectionStatus?: string;
	isSelectedConnected?: boolean;
	yarnColor?: MemoTone;
	onYarnColorChange?: (tone: MemoTone) => void;
	onCenterSelected?: () => void;
	onConnectSelected?: () => void;
	onDisconnectSelected?: () => void;
	onOpenSelected?: () => void;
	onOpenConnectedMemo?: (memoId: number) => void;
	tags: Array<{ id: number; name: string }>;
	titleDraft: string;
	onTitleChange: (value: string) => void;
	onTitleCommit: (nextTitle?: string) => void;
	editorText: string;
	onEditorChange: (value: string) => void;
	onDelete: () => void;
	onTogglePinned: () => void;
	onToneChange: (tone: MemoTone) => void;
	onPinColorChange: (tone: MemoTone) => void;
	saveState: SaveState;
	tagInput: string;
	onTagInputChange: (value: string) => void;
	onCreateTag: () => void;
	onToggleTag: (tagId: number) => void;
	selectedMemoTagIds: number[];
	connectedMemos: MemoRecord[];
	mode: "desktop" | "mobile-sheet";
	designVariant: MemoDesignVariant;
	mobilePinControlHidden: boolean;
	onToggleMobilePinControlHidden: () => void;
	sheetSnap: SheetSnap;
	onSetSheetSnap: (snap: SheetSnap) => void;
	onRequestClose: () => void;
}) {
	const isMobilePane = mode === "mobile-sheet";
	const memoId = memo?.id ?? null;
	const [isMobileMetaOpen, setIsMobileMetaOpen] = useState(false);
	const [isMobileColorOpen, setIsMobileColorOpen] = useState(false);
	const variantStyle = getBrainVariantStyle(designVariant);
	const notePalette = variantStyle.palette.notes[memo?.tone ?? "sun"];
	const isCenterMemo = Boolean(memo && centerMemo && memo.id === centerMemo.id);
	const canStyleYarn = Boolean(memo && centerMemo && !isCenterMemo);
	const shellStyle = memo
		? {
				background: `linear-gradient(180deg, ${notePalette.paperA} 0%, ${notePalette.paperB} 100%)`,
				borderColor: `${notePalette.line}44`,
				boxShadow: `0 26px 40px -30px ${notePalette.shadow}`,
				color: notePalette.text,
			}
		: undefined;
	const fieldStyle = memo
		? {
				backgroundColor: "rgba(255,255,255,0.28)",
				borderColor: `${notePalette.line}33`,
				color: notePalette.text,
			}
		: undefined;

	useEffect(() => {
		if (!isMobilePane) {
			return;
		}
		if (memoId === null) {
			setIsMobileMetaOpen(false);
			setIsMobileColorOpen(false);
			return;
		}
		setIsMobileMetaOpen(false);
		setIsMobileColorOpen(false);
	}, [isMobilePane, memoId]);

	useEffect(() => {
		if (!isMobilePane) {
			return;
		}
		const handleEscape = (event: KeyboardEvent) => {
			if (event.key === "Escape") {
				onRequestClose();
			}
		};
		document.addEventListener("keydown", handleEscape);
		return () => {
			document.removeEventListener("keydown", handleEscape);
		};
	}, [isMobilePane, onRequestClose]);

	const palettePicker = (
		testSlug: string,
		label: string,
		activeTone: MemoTone,
		onSelect: (tone: MemoTone) => void,
		disabled = false,
	) => {
		return (
			<div className="grid gap-2" data-testid={`memo-palette-${testSlug}`}>
				<p className="text-xs font-semibold uppercase tracking-[0.12em] opacity-70">
					{label}
				</p>
				<div className="flex flex-wrap gap-2">
					{toneOptions.map((tone) => {
						const active = activeTone === tone.key;
						return (
							<button
								type="button"
								key={`${label}-${tone.key}`}
								onClick={() => onSelect(tone.key)}
								disabled={disabled}
								data-testid={`memo-palette-${testSlug}-${tone.key}`}
								className={cn(
									"inline-flex min-h-10 items-center gap-2 rounded-[var(--memo-radius-control)] border px-3 text-xs font-semibold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] disabled:cursor-not-allowed disabled:opacity-45",
									active
										? "border-[#6f4620] bg-[#6f4620] text-white"
										: "border-[rgba(86,58,29,0.18)] bg-white/40 text-[#55391e]",
								)}
							>
								<span
									className={cn("h-2.5 w-2.5 rounded-full", tone.dotClass)}
								/>
								{tone.label}
							</button>
						);
					})}
				</div>
			</div>
		);
	};

	const metaSection = memo ? (
		<div className="space-y-4">
			{palettePicker("post-it-color", "포스트잇 색", memo.tone, onToneChange)}
			{palettePicker("pin-color", "핀 색", memo.pin_color, onPinColorChange)}
			{palettePicker(
				"yarn",
				"실 색",
				yarnColor,
				(tone) => onYarnColorChange?.(tone),
				!canStyleYarn,
			)}

			<div className="grid gap-2">
				<div className="flex flex-wrap items-center justify-between gap-2">
					<p className="text-xs font-semibold uppercase tracking-[0.12em] opacity-70">
						연결 상태
					</p>
					<span
						className="rounded-[var(--memo-radius-chip)] bg-white/45 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-[#6a4b29]"
						data-testid="memo-editor-connection-status"
					>
						{selectedConnectionStatus}
					</span>
				</div>
				{canStyleYarn ? (
					<button
						type="button"
						onClick={onCenterSelected}
						data-testid="memo-editor-center-selected"
						className="inline-flex min-h-10 items-center rounded-[var(--memo-radius-control)] border border-[rgba(86,58,29,0.18)] bg-white/40 px-3 text-xs font-semibold uppercase tracking-[0.11em] text-[#55391e] transition hover:border-[#9f7a4c] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
					>
						중심으로 보기
					</button>
				) : (
					<p className="text-xs text-[#6e5a46]">
						현재 선택한 포스트잇이 중심입니다. 다른 포스트잇을 선택하면 연결
						색을 고를 수 있습니다.
					</p>
				)}
			</div>

			<div className="grid gap-2">
				<div className="flex items-center justify-between gap-3">
					<p className="text-xs font-semibold uppercase tracking-[0.12em] opacity-70">
						태그
					</p>
					{memo.tags.length > 0 ? (
						<div className="flex flex-wrap gap-1.5">
							{memo.tags.map((tag) => (
								<span
									key={tag.id}
									className="inline-flex min-h-6 items-center rounded-[var(--memo-radius-chip)] border border-[rgba(86,58,29,0.14)] bg-white/35 px-2 text-[11px] font-medium text-[#56381e]"
								>
									#{tag.name}
								</span>
							))}
						</div>
					) : null}
				</div>
				<div className="flex gap-2">
					<input
						type="text"
						value={tagInput}
						onChange={(event) => onTagInputChange(event.target.value)}
						onKeyDown={(event) => {
							if (event.key === "Enter") {
								event.preventDefault();
								onCreateTag();
							}
						}}
						placeholder="태그 만들기"
						className="h-10 flex-1 rounded-[var(--memo-radius-control)] border px-3 text-sm outline-none focus-visible:ring-4 focus-visible:ring-[var(--focus-ring)]"
						style={fieldStyle}
					/>
					<button
						type="button"
						onClick={onCreateTag}
						className="inline-flex h-10 items-center justify-center rounded-[var(--memo-radius-control)] border border-[rgba(86,58,29,0.18)] bg-white/40 px-4 text-xs font-semibold uppercase tracking-[0.1em] text-[#55391e] transition hover:border-[#9f7a4c] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
					>
						추가
					</button>
				</div>
				{tags.length > 0 ? (
					<div className="flex flex-wrap gap-2">
						{tags.map((tag) => {
							const selected = selectedMemoTagIds.includes(tag.id);
							return (
								<button
									type="button"
									key={tag.id}
									onClick={() => onToggleTag(tag.id)}
									className={cn(
										"inline-flex min-h-10 items-center rounded-[var(--memo-radius-control)] border px-3 text-xs font-semibold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]",
										selected
											? "border-[#6f4620] bg-[#6f4620] text-white"
											: "border-[rgba(86,58,29,0.18)] bg-white/40 text-[#55391e]",
									)}
								>
									#{tag.name}
								</button>
							);
						})}
					</div>
				) : null}
			</div>

			<div className="grid gap-2">
				<p className="text-xs font-semibold uppercase tracking-[0.12em] opacity-70">
					연결
				</p>
				<p className="text-sm font-medium text-[#4f381f]">
					연결 {memo.connected_ids.length}
				</p>
				{connectedMemos.length > 0 ? (
					<div className="flex flex-wrap gap-2">
						{connectedMemos.slice(0, 4).map((linkedMemo) => (
							<button
								key={linkedMemo.id}
								type="button"
								onClick={() => onOpenConnectedMemo?.(linkedMemo.id)}
								className="inline-flex min-h-8 items-center rounded-[var(--memo-radius-control)] border border-[rgba(86,58,29,0.14)] bg-white/35 px-3 text-xs font-medium text-[#55391e] transition hover:border-[#9f7a4c] hover:bg-white/55 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
								data-testid={`memo-editor-connected-memo-${linkedMemo.id}`}
							>
								{linkedMemo.title}
							</button>
						))}
					</div>
				) : (
					<p className="text-xs text-[#6e5a46]">
						아직 연결된 메모가 없습니다. 다른 포스트잇을 골라 실을 이어보세요.
					</p>
				)}
			</div>

			<div className="flex flex-wrap gap-2 pt-1">
				<button
					type="button"
					onClick={onTogglePinned}
					className={cn(
						"inline-flex min-h-10 items-center rounded-[var(--memo-radius-control)] border px-3 text-xs font-semibold uppercase tracking-[0.11em] transition focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]",
						memo.is_pinned
							? "border-[#6f4620] bg-[#6f4620] text-white"
							: "border-[rgba(86,58,29,0.18)] bg-white/40 text-[#55391e]",
					)}
				>
					{memo.is_pinned ? "고정됨" : "핀 고정"}
				</button>
				{onOpenSelected ? (
					<button
						type="button"
						onClick={onOpenSelected}
						className="inline-flex min-h-10 items-center rounded-[var(--memo-radius-control)] border border-[rgba(86,58,29,0.18)] bg-white/40 px-3 text-xs font-semibold uppercase tracking-[0.11em] text-[#55391e] transition hover:border-[#9f7a4c] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
					>
						열기
					</button>
				) : null}
				<button
					type="button"
					onClick={onDelete}
					className="inline-flex min-h-10 items-center rounded-[var(--memo-radius-control)] bg-[#7d2435] px-4 text-xs font-semibold uppercase tracking-[0.11em] text-white transition hover:bg-[#93293d] focus:outline-none focus-visible:ring-4 focus-visible:ring-[var(--focus-ring)]"
				>
					메모 삭제
				</button>
			</div>
		</div>
	) : null;

	return (
		<section
			className="relative flex h-full min-h-0 flex-col overflow-hidden rounded-[1.5rem] border lg:min-h-[24rem]"
			data-memo-theme={designVariant}
			style={shellStyle}
		>
			{memo ? (
				<div className="pointer-events-none absolute right-0 top-0 h-20 w-20 rounded-bl-[2rem] bg-white/20" />
			) : null}
			<header className="relative shrink-0 border-b border-[rgba(86,58,29,0.14)] px-4 py-3">
				<div className="flex items-center justify-between gap-2">
					<div>
						<p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#7a5c37]">
							포스트잇 편집
						</p>
						<p
							className="mt-1 text-xs text-[#6e5a46]"
							data-testid="memo-editor-updated-at"
						>
							{memo ? formatDateTime(memo.updated_at) : "메모를 선택하세요"}
						</p>
					</div>

					<div className="flex items-center gap-2">
						<SaveBadge state={saveState} />
						{isMobilePane ? (
							<PopoverMenu
								icon={
									<Icon
										name="more-horizontal"
										className="h-4 w-4"
										title="작업"
									/>
								}
								title="편집 작업"
								triggerTestId="memo-sheet-action-menu-trigger"
								menuTestId="memo-sheet-action-menu"
							>
								<div className="p-1">
									<button
										type="button"
										onClick={onTogglePinned}
										className="block w-full rounded-[var(--memo-radius-chip)] px-3 py-2 text-left text-sm font-medium text-[#55391e] transition hover:bg-white/45"
										data-testid="memo-sheet-action-pin-toggle"
									>
										{memo?.is_pinned ? "고정 해제" : "핀 고정"}
									</button>
									<button
										type="button"
										onClick={onToggleMobilePinControlHidden}
										className="mt-1 block w-full rounded-[var(--memo-radius-chip)] px-3 py-2 text-left text-sm font-medium text-[#55391e] transition hover:bg-white/45"
										data-testid="memo-sheet-action-pin-control-visibility"
									>
										{mobilePinControlHidden
											? "핀 조절 보기"
											: "핀 조절 숨기기"}
									</button>
									<button
										type="button"
										onClick={() => {
											if (sheetSnap === "full") {
												onSetSheetSnap("mid");
												return;
											}
											onSetSheetSnap(sheetSnap === "peek" ? "mid" : "full");
										}}
										className="mt-1 block w-full rounded-[var(--memo-radius-chip)] px-3 py-2 text-left text-sm font-medium text-[#55391e] transition hover:bg-white/45"
										data-testid="memo-sheet-action-snap-toggle"
									>
										{sheetSnap === "full" ? "시트 되돌리기" : "시트 펼치기"}
									</button>
								</div>
							</PopoverMenu>
						) : null}
					</div>
				</div>

				{memo ? (
					<div className="mt-3 grid gap-2">
						<input
							type="text"
							value={titleDraft}
							onChange={(event) => onTitleChange(event.target.value)}
							onBlur={(event) => onTitleCommit(event.target.value)}
							onKeyDown={(event) => {
								if (event.key === "Enter") {
									event.preventDefault();
									onTitleCommit(event.currentTarget.value);
								}
							}}
							className="h-11 rounded-[var(--memo-radius-control)] border px-3 text-sm font-semibold outline-none transition focus-visible:border-[var(--accent)] focus-visible:ring-4 focus-visible:ring-[var(--focus-ring)]"
							style={fieldStyle}
							data-testid="memo-editor-title"
						/>

						{isMobilePane ? (
							<div className="grid gap-2">
								<div className="flex flex-wrap items-center gap-2">
									{!mobilePinControlHidden ? (
										<button
											type="button"
											onClick={onTogglePinned}
											className={cn(
												"inline-flex min-h-10 items-center rounded-[var(--memo-radius-control)] border px-3 text-xs font-semibold uppercase tracking-[0.11em] transition focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]",
												memo.is_pinned
													? "border-[#6f4620] bg-[#6f4620] text-white"
													: "border-[rgba(86,58,29,0.18)] bg-white/40 text-[#55391e]",
											)}
											data-testid="memo-editor-pin-button"
										>
											{memo.is_pinned ? "고정됨" : "핀 고정"}
										</button>
									) : null}
									<button
										type="button"
										onClick={() => setIsMobileColorOpen((prev) => !prev)}
										className="inline-flex min-h-10 items-center gap-2 rounded-[var(--memo-radius-control)] border border-[rgba(86,58,29,0.18)] bg-white/40 px-3 text-xs font-semibold uppercase tracking-[0.11em] text-[#55391e] transition hover:border-[#9f7a4c] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
										data-testid="memo-editor-color-toggle"
										aria-expanded={isMobileColorOpen}
									>
										<span className="h-2.5 w-2.5 rounded-full bg-[#6f4620]" />
										색상 팔레트
									</button>
								</div>

								{isMobileColorOpen ? (
									<div data-testid="memo-editor-color-palette">
										{metaSection}
									</div>
								) : null}
							</div>
						) : null}
					</div>
				) : null}
			</header>

			{memo ? (
				<div
					className={cn(
						"min-h-0 flex-1",
						isMobilePane
							? "overflow-y-auto overscroll-contain"
							: "grid grid-rows-[minmax(0,1fr)_auto]",
					)}
					data-testid="memo-editor-scroll"
				>
					{isMobilePane ? (
						<div className="space-y-4 p-4">
							<textarea
								value={editorText}
								onChange={(event) => onEditorChange(event.target.value)}
								placeholder="메모 내용을 적어보세요."
								className="min-h-[12rem] w-full rounded-[var(--memo-radius-panel)] border p-4 text-[15px] leading-7 outline-none transition placeholder:text-[#6e5a46] focus-visible:border-[var(--accent)] focus-visible:ring-4 focus-visible:ring-[var(--focus-ring)] [min-height:max(12rem,32dvh)]"
								style={fieldStyle}
								data-testid="memo-editor-textarea"
							/>

							<button
								type="button"
								onClick={() => setIsMobileMetaOpen((prev) => !prev)}
								className="inline-flex min-h-10 items-center rounded-[var(--memo-radius-control)] border border-[rgba(86,58,29,0.18)] bg-white/40 px-3 text-xs font-semibold uppercase tracking-[0.11em] text-[#55391e] transition hover:border-[#9f7a4c] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
								data-testid="memo-editor-meta-toggle"
								aria-expanded={isMobileMetaOpen}
							>
								{isMobileMetaOpen ? "세부 정보 닫기" : "세부 정보"}
							</button>

							{isMobileMetaOpen ? (
								<div
									className="space-y-3 border-t border-[rgba(86,58,29,0.14)] pt-4"
									data-testid="memo-editor-meta"
								>
									{metaSection}
								</div>
							) : null}
						</div>
					) : (
						<>
							<div className="min-h-0 p-4">
								<textarea
									value={editorText}
									onChange={(event) => onEditorChange(event.target.value)}
									placeholder="메모 내용을 적어보세요."
									className="h-full w-full rounded-[var(--memo-radius-panel)] border p-4 text-[15px] leading-7 outline-none transition placeholder:text-[#6e5a46] focus-visible:border-[var(--accent)] focus-visible:ring-4 focus-visible:ring-[var(--focus-ring)]"
									style={fieldStyle}
									data-testid="memo-editor-textarea"
								/>
							</div>
							<div
								className="space-y-3 border-t border-[rgba(86,58,29,0.14)] p-4"
								data-testid="memo-editor-meta"
							>
								{metaSection}
							</div>
						</>
					)}
				</div>
			) : (
				<div className="grid h-full place-items-center p-6 text-center">
					<div>
						<p className="text-base font-medium text-[var(--text-primary)]">
							No memo selected
						</p>
						<p className="mt-2 text-sm text-[var(--text-secondary)]">
							Pick a memo from the board to start editing.
						</p>
					</div>
				</div>
			)}
		</section>
	);
}

function drawRoundedRect(
	context: CanvasRenderingContext2D,
	x: number,
	y: number,
	width: number,
	height: number,
	radius: number,
) {
	const left = x - width / 2;
	const top = y - height / 2;
	const right = left + width;
	const bottom = top + height;
	const r = Math.min(radius, width / 2, height / 2);
	context.beginPath();
	context.moveTo(left + r, top);
	context.lineTo(right - r, top);
	context.quadraticCurveTo(right, top, right, top + r);
	context.lineTo(right, bottom - r);
	context.quadraticCurveTo(right, bottom, right - r, bottom);
	context.lineTo(left + r, bottom);
	context.quadraticCurveTo(left, bottom, left, bottom - r);
	context.lineTo(left, top + r);
	context.quadraticCurveTo(left, top, left + r, top);
	context.closePath();
}

function drawTokenPath(
	context: CanvasRenderingContext2D,
	x: number,
	y: number,
	width: number,
	height: number,
) {
	context.beginPath();
	context.ellipse(x, y, width / 2, height / 2, 0, 0, Math.PI * 2);
	context.closePath();
}

function drawBrainNodePath(
	context: CanvasRenderingContext2D,
	node: Pick<
		BrainCanvasNodeHit | BrainNodeLayout,
		"x" | "y" | "width" | "height" | "borderRadius" | "shape"
	>,
) {
	if (node.shape === "token") {
		drawTokenPath(context, node.x, node.y, node.width, node.height);
		return;
	}
	drawRoundedRect(
		context,
		node.x,
		node.y,
		node.width,
		node.height,
		node.borderRadius,
	);
}

function pointInRoundedRect(
	px: number,
	py: number,
	node: Pick<
		BrainCanvasNodeHit,
		"x" | "y" | "width" | "height" | "borderRadius"
	>,
) {
	const left = node.x - node.width / 2;
	const top = node.y - node.height / 2;
	const right = left + node.width;
	const bottom = top + node.height;
	if (px < left || px > right || py < top || py > bottom) {
		return false;
	}
	const radius = Math.min(node.borderRadius, node.width / 2, node.height / 2);
	const innerLeft = left + radius;
	const innerRight = right - radius;
	const innerTop = top + radius;
	const innerBottom = bottom - radius;
	if (px >= innerLeft && px <= innerRight) {
		return true;
	}
	if (py >= innerTop && py <= innerBottom) {
		return true;
	}
	const corners = [
		{ x: innerLeft, y: innerTop },
		{ x: innerRight, y: innerTop },
		{ x: innerLeft, y: innerBottom },
		{ x: innerRight, y: innerBottom },
	];
	return corners.some(
		(corner) => Math.hypot(px - corner.x, py - corner.y) <= radius,
	);
}

function pointInToken(
	px: number,
	py: number,
	node: Pick<BrainCanvasNodeHit, "x" | "y" | "width" | "height">,
) {
	const rx = node.width / 2;
	const ry = node.height / 2;
	if (rx <= 0 || ry <= 0) {
		return false;
	}
	return (px - node.x) ** 2 / rx ** 2 + (py - node.y) ** 2 / ry ** 2 <= 1;
}

function pointInBrainNode(
	px: number,
	py: number,
	node: Pick<
		BrainCanvasNodeHit,
		"x" | "y" | "width" | "height" | "borderRadius" | "shape"
	>,
) {
	if (node.shape === "token") {
		return pointInToken(px, py, node);
	}
	return pointInRoundedRect(px, py, node);
}

function getNodeAnchor(
	node: Pick<BrainNodeLayout, "x" | "y" | "width" | "height" | "shape">,
	towardX: number,
	towardY: number,
) {
	const dx = towardX - node.x;
	const dy = towardY - node.y;
	if (dx === 0 && dy === 0) {
		return { x: node.x, y: node.y };
	}
	if (node.shape === "token") {
		const rx = node.width / 2;
		const ry = node.height / 2;
		const scale = 1 / Math.hypot(dx / rx, dy / ry);
		return {
			x: node.x + dx * scale * 0.92,
			y: node.y + dy * scale * 0.92,
		};
	}
	const halfWidth = node.width / 2;
	const halfHeight = node.height / 2;
	const scale =
		1 / Math.max(Math.abs(dx) / halfWidth, Math.abs(dy) / halfHeight);
	return {
		x: node.x + dx * scale * 0.94,
		y: node.y + dy * scale * 0.94,
	};
}

function truncateLabel(value: string, maxLength: number) {
	if (value.length <= maxLength) {
		return value;
	}
	return `${value.slice(0, maxLength - 1)}…`;
}

function buildNeuralCurve(
	start: BrainCanvasPoint,
	end: BrainCanvasPoint,
	origin: BrainCanvasPoint,
	curveBend: number,
) {
	const dx = end.x - start.x;
	const dy = end.y - start.y;
	const distance = Math.max(1, Math.hypot(dx, dy));
	const nx = -dy / distance;
	const ny = dx / distance;
	const midX = (start.x + end.x) / 2;
	const midY = (start.y + end.y) / 2;
	const towardOriginX = midX - origin.x;
	const towardOriginY = midY - origin.y;
	const direction = towardOriginX * nx + towardOriginY * ny >= 0 ? 1 : -1;
	const bend = distance * curveBend * direction;
	return {
		start,
		controlA: {
			x: start.x + dx * 0.28 + nx * bend,
			y: start.y + dy * 0.28 + ny * bend,
		},
		controlB: {
			x: start.x + dx * 0.72 + nx * bend * 0.72,
			y: start.y + dy * 0.72 + ny * bend * 0.72,
		},
		end,
	};
}

function getCubicBezierPoint(
	curve: ReturnType<typeof buildNeuralCurve>,
	t: number,
): BrainCanvasPoint {
	const inverse = 1 - t;
	return {
		x:
			inverse ** 3 * curve.start.x +
			3 * inverse ** 2 * t * curve.controlA.x +
			3 * inverse * t ** 2 * curve.controlB.x +
			t ** 3 * curve.end.x,
		y:
			inverse ** 3 * curve.start.y +
			3 * inverse ** 2 * t * curve.controlA.y +
			3 * inverse * t ** 2 * curve.controlB.y +
			t ** 3 * curve.end.y,
	};
}

function sampleCurvePoints(
	curve: ReturnType<typeof buildNeuralCurve>,
	segments = 24,
) {
	return Array.from({ length: segments + 1 }, (_, index) =>
		getCubicBezierPoint(curve, index / segments),
	);
}

function drawCurvePath(
	context: CanvasRenderingContext2D,
	curve: ReturnType<typeof buildNeuralCurve>,
) {
	context.beginPath();
	context.moveTo(curve.start.x, curve.start.y);
	context.bezierCurveTo(
		curve.controlA.x,
		curve.controlA.y,
		curve.controlB.x,
		curve.controlB.y,
		curve.end.x,
		curve.end.y,
	);
}

function drawTwistedYarn(
	context: CanvasRenderingContext2D,
	points: BrainCanvasPoint[],
	yarn: BrainVariantStyle["palette"]["yarns"][MemoTone],
	baseWidth: number,
	highlighted: boolean,
	time: number,
	seedPhase: number,
) {
	if (points.length < 2) return;

	// Compute perpendicular normals at each point for strand offset
	const perps: BrainCanvasPoint[] = [];
	for (let i = 0; i < points.length; i++) {
		const prev = points[Math.max(0, i - 1)];
		const next = points[Math.min(points.length - 1, i + 1)];
		const dx = next.x - prev.x;
		const dy = next.y - prev.y;
		const len = Math.hypot(dx, dy) || 1;
		perps.push({ x: -dy / len, y: dx / len });
	}

	// Gentle time-based sway (full cycle ~15s at default speed)
	const gentleSway = Math.sin(time * 0.00042 + seedPhase) * 0.9;

	// Outer drop-shadow
	context.save();
	context.beginPath();
	context.moveTo(points[0].x, points[0].y);
	for (let i = 1; i < points.length; i++) {
		context.lineTo(points[i].x, points[i].y);
	}
	context.lineWidth = baseWidth + 9;
	context.strokeStyle = yarn.shadow;
	context.globalAlpha = highlighted ? 0.26 : 0.14;
	context.lineCap = "round";
	context.lineJoin = "round";
	context.stroke();
	context.restore();

	// Draw twisted strands
	const numStrands = 5;
	const twists = 3.2;
	const amplitude = baseWidth * 0.44;

	for (let strand = 0; strand < numStrands; strand++) {
		const strandPhase = (strand / numStrands) * Math.PI * 2;
		const isHighlightStrand = strand === numStrands - 1;
		const isShadowStrand = strand === 1;
		const strandAlpha = isHighlightStrand
			? highlighted
				? 0.82
				: 0.62
			: highlighted
				? 0.9
				: 0.75;
		const strandWidth = isHighlightStrand
			? baseWidth * 0.14
			: isShadowStrand
				? baseWidth * 0.3
				: baseWidth * 0.26;
		const strandColor = isHighlightStrand
			? yarn.highlight
			: isShadowStrand
				? yarn.shadow
				: strand % 2 === 0
					? yarn.base
					: yarn.shadow;

		context.save();
		context.beginPath();
		for (let i = 0; i < points.length; i++) {
			const t = i / (points.length - 1);
			const twist =
				Math.sin(t * twists * Math.PI * 2 + strandPhase) * amplitude;
			// Catenary-like sag: sin(π·t) peaks at midpoint, sway adds gentle oscillation
			const swayOffset =
				gentleSway * Math.sin(t * Math.PI) * baseWidth * 0.18;
			const offset = twist + swayOffset;
			const px = points[i].x + perps[i].x * offset;
			const py = points[i].y + perps[i].y * offset;
			if (i === 0) context.moveTo(px, py);
			else context.lineTo(px, py);
		}
		context.lineWidth = strandWidth;
		context.strokeStyle = strandColor;
		context.globalAlpha = strandAlpha;
		context.lineCap = "round";
		context.lineJoin = "round";
		if (highlighted) {
			context.shadowBlur = 10;
			context.shadowColor = yarn.highlight;
		}
		context.stroke();
		context.restore();
	}

	// Tack knots at both endpoints
	for (const point of [points[0], points[points.length - 1]]) {
		context.save();
		context.beginPath();
		context.arc(point.x, point.y, baseWidth * 0.55, 0, Math.PI * 2);
		context.fillStyle = yarn.base;
		context.globalAlpha = 0.45;
		context.shadowBlur = 5;
		context.shadowColor = yarn.shadow;
		context.fill();
		// Specular on knot
		context.beginPath();
		context.arc(
			point.x - baseWidth * 0.12,
			point.y - baseWidth * 0.12,
			baseWidth * 0.18,
			0,
			Math.PI * 2,
		);
		context.fillStyle = yarn.highlight;
		context.globalAlpha = 0.5;
		context.fill();
		context.restore();
	}
}

function drawOrganicBackdrop(
	context: CanvasRenderingContext2D,
	width: number,
	height: number,
	style: BrainVariantStyle,
) {
	// Rich multi-stop cork base
	const base = context.createLinearGradient(
		width * 0.1,
		height * 0.05,
		width * 0.92,
		height * 0.96,
	);
	base.addColorStop(0, style.cork.boardA);
	base.addColorStop(0.28, style.background.baseB);
	base.addColorStop(0.62, style.cork.boardB);
	base.addColorStop(1, style.background.baseC);
	context.fillStyle = base;
	context.fillRect(0, 0, width, height);

	// Cork fiber strokes — elongated ellipses at varied angles
	for (let index = 0; index < 220; index += 1) {
		const x = (((index * 53 + 7) % 100) / 100) * width;
		const y = (((index * 67 + 13) % 100) / 100) * height;
		const angle = (((index * 31 + 3) % 100) / 100) * Math.PI;
		const fiberLen = 5 + ((index * 17) % 7) * 2.2;
		const fiberThick = 0.55 + ((index * 11) % 3) * 0.32;
		context.save();
		context.translate(x, y);
		context.rotate(angle);
		context.beginPath();
		context.ellipse(0, 0, fiberLen / 2, fiberThick / 2, 0, 0, Math.PI * 2);
		context.fillStyle =
			index % 3 === 0 ? style.cork.fleckLight : style.cork.fleckDark;
		context.globalAlpha = 0.55 + ((index * 7) % 4) * 0.1;
		context.fill();
		context.restore();
	}

	// Fine round pore flecks
	for (let index = 0; index < 140; index += 1) {
		const x = (((index * 83 + 29) % 100) / 100) * width;
		const y = (((index * 61 + 41) % 100) / 100) * height;
		const radius = 0.4 + ((index * 13) % 4) * 0.25;
		context.beginPath();
		context.arc(x, y, radius, 0, Math.PI * 2);
		context.fillStyle =
			index % 2 === 0 ? style.cork.fleckDark : style.cork.fleckLight;
		context.globalAlpha = 0.5 + ((index * 5) % 3) * 0.1;
		context.fill();
	}
	context.globalAlpha = 1;

	// Horizontal grain streaks (very subtle)
	for (let index = 0; index < 48; index += 1) {
		const y = (((index * 41 + 11) % 100) / 100) * height;
		const x1 = (((index * 23) % 22) - 6) * 0.5;
		const x2 = width + (((index * 37) % 18) - 9) * 0.5;
		context.beginPath();
		context.moveTo(x1, y + ((index * 3) % 3) - 1);
		context.lineTo(x2, y + (((index + 2) * 3) % 3) - 0.5);
		context.strokeStyle =
			index % 2 === 0 ? style.cork.fleckDark : style.cork.fleckLight;
		context.lineWidth = 0.35 + ((index % 3) * 0.15);
		context.globalAlpha = 0.07 + ((index % 4) * 0.02);
		context.stroke();
	}
	context.globalAlpha = 1;

	// Warm central radiance (amber light source)
	const warmth = context.createRadialGradient(
		width * 0.46,
		height * 0.42,
		0,
		width * 0.5,
		height * 0.5,
		Math.max(width, height) * 0.64,
	);
	warmth.addColorStop(0, "rgba(255, 225, 158, 0.13)");
	warmth.addColorStop(0.38, "rgba(220, 175, 90, 0.06)");
	warmth.addColorStop(1, "rgba(0, 0, 0, 0)");
	context.fillStyle = warmth;
	context.fillRect(0, 0, width, height);

	// Outer frame — dark wood border
	context.strokeStyle = style.cork.frame;
	context.lineWidth = 22;
	context.strokeRect(0, 0, width, height);

	// Inner bevel highlight
	context.strokeStyle = "rgba(255, 220, 160, 0.12)";
	context.lineWidth = 2.5;
	context.strokeRect(14, 14, width - 28, height - 28);

	// Edge shadow bevel (dark inner rim)
	context.strokeStyle = "rgba(0, 0, 0, 0.08)";
	context.lineWidth = 5;
	context.strokeRect(11, 11, width - 22, height - 22);

	// Vignette
	const vignette = context.createRadialGradient(
		width * 0.5,
		height * 0.5,
		Math.min(width, height) * 0.06,
		width * 0.5,
		height * 0.5,
		Math.max(width, height) * 0.74,
	);
	vignette.addColorStop(0, "rgba(0, 0, 0, 0)");
	vignette.addColorStop(0.6, "rgba(0, 0, 0, 0)");
	vignette.addColorStop(1, style.background.vignette);
	context.fillStyle = vignette;
	context.fillRect(0, 0, width, height);
}

function wrapStickyPreview(
	context: CanvasRenderingContext2D,
	text: string,
	maxWidth: number,
) {
	const words = text.split(" ");
	const lines: string[] = [];
	let current = "";
	for (const word of words) {
		const candidate = current ? `${current} ${word}` : word;
		if (context.measureText(candidate).width > maxWidth && current) {
			lines.push(current);
			current = word;
			if (lines.length === 2) {
				break;
			}
			continue;
		}
		current = candidate;
	}
	if (current && lines.length < 2) {
		lines.push(current);
	}
	return lines.slice(0, 2);
}

function drawOrganicNode(
	context: CanvasRenderingContext2D,
	{
		x,
		y,
		width,
		height,
		borderRadius,
		shape,
		paper,
		pin,
		stroke,
		halo,
		shadow,
		lineWidth,
		isCandidate = false,
		isCenter = false,
		nodeId = 0,
	}: {
		x: number;
		y: number;
		width: number;
		height: number;
		borderRadius: number;
		shape: BrainNodeShapeKind;
		paper: BrainVariantStyle["palette"]["notes"][MemoTone];
		pin: BrainVariantStyle["palette"]["pins"][MemoTone];
		stroke: string;
		halo: string;
		shadow: string;
		lineWidth: number;
		isCandidate?: boolean;
		isCenter?: boolean;
		nodeId?: number;
	},
) {
	if (shape === "token") {
		const fill = context.createLinearGradient(
			x - width * 0.42,
			y - height * 0.5,
			x + width * 0.46,
			y + height * 0.56,
		);
		fill.addColorStop(0, paper.paperA);
		fill.addColorStop(1, paper.paperB);
		context.save();
		drawBrainNodePath(context, { x, y, width, height, borderRadius, shape });
		context.fillStyle = fill;
		context.shadowBlur = 12;
		context.shadowColor = shadow;
		context.fill();
		context.lineWidth = lineWidth;
		context.strokeStyle = stroke;
		context.stroke();
		context.restore();
		return;
	}

	// Slight per-note deterministic tilt for organic feel
	const tiltSeed = (nodeId * 7919 + 3571) % 1000;
	const tilt = (tiltSeed / 1000 - 0.5) * 0.038;

	context.save();
	context.translate(x, y);
	context.rotate(tilt);

	// Soft diffuse halo behind the note
	drawBrainNodePath(context, {
		x: 0,
		y: 12,
		width: width + (isCenter ? 32 : 20),
		height: height + (isCenter ? 28 : 18),
		borderRadius: borderRadius + (isCenter ? 14 : 9),
		shape,
	});
	context.fillStyle = halo;
	context.fill();

	// Paper body gradient
	const fill = context.createLinearGradient(
		-width * 0.42,
		-height * 0.5,
		width * 0.46,
		height * 0.56,
	);
	fill.addColorStop(0, paper.paperA);
	fill.addColorStop(0.62, paper.paperB);
	fill.addColorStop(1, paper.fold);

	context.setLineDash(isCandidate ? [6, 4] : []);
	context.shadowBlur = isCenter ? 28 : 14;
	context.shadowColor = shadow;
	drawBrainNodePath(context, {
		x: 0,
		y: 0,
		width,
		height,
		borderRadius,
		shape,
	});
	context.fillStyle = fill;
	context.fill();
	context.lineWidth = lineWidth;
	context.strokeStyle = stroke;
	context.shadowBlur = 0;
	context.stroke();
	context.setLineDash([]);

	// Subtle top sheen
	const sheenGrad = context.createLinearGradient(
		-width * 0.5,
		-height * 0.5,
		-width * 0.5,
		-height * 0.5 + height * 0.28,
	);
	sheenGrad.addColorStop(0, "rgba(255,255,255,0.28)");
	sheenGrad.addColorStop(1, "rgba(255,255,255,0)");
	drawBrainNodePath(context, { x: 0, y: 0, width, height, borderRadius, shape });
	context.fillStyle = sheenGrad;
	context.fill();

	// Horizontal ruling lines (notebook paper effect)
	context.save();
	context.beginPath();
	drawBrainNodePath(context, { x: 0, y: 0, width, height, borderRadius, shape });
	context.clip();
	const ruleStartY = -height / 2 + 54;
	const ruleEndY = height / 2 - 10;
	const ruleSpacing = 15;
	context.globalAlpha = 0.055;
	for (let ry = ruleStartY; ry < ruleEndY; ry += ruleSpacing) {
		context.beginPath();
		context.moveTo(-width / 2 + 10, ry);
		context.lineTo(width / 2 - 10, ry);
		context.strokeStyle = paper.line;
		context.lineWidth = 0.7;
		context.stroke();
	}
	context.globalAlpha = 1;
	context.restore();

	// Folded corner (top-right)
	const foldSize = isCenter ? 28 : 22;
	context.save();
	context.beginPath();
	context.moveTo(width / 2 - foldSize, -height / 2);
	context.lineTo(width / 2, -height / 2);
	context.lineTo(width / 2, -height / 2 + foldSize);
	context.closePath();
	// Fold shadow gradient
	const foldGrad = context.createLinearGradient(
		width / 2 - foldSize,
		-height / 2,
		width / 2,
		-height / 2 + foldSize,
	);
	foldGrad.addColorStop(0, paper.fold);
	foldGrad.addColorStop(1, `${paper.fold}cc`);
	context.fillStyle = foldGrad;
	context.shadowBlur = 4;
	context.shadowColor = shadow;
	context.fill();
	context.restore();

	// Fold crease line
	context.save();
	context.beginPath();
	context.moveTo(width / 2 - foldSize, -height / 2);
	context.lineTo(width / 2, -height / 2 + foldSize);
	context.strokeStyle = `${paper.line}66`;
	context.lineWidth = 0.9;
	context.stroke();
	context.restore();

	// 3D push-pin
	const pinR = isCenter ? 8.5 : 6.8;
	const pinX = 0;
	const pinY = -height / 2 + pinR + 10;

	// Pin shadow drop
	context.save();
	context.beginPath();
	context.ellipse(pinX + 2, pinY + 4, pinR * 0.8, pinR * 0.4, 0, 0, Math.PI * 2);
	context.fillStyle = pin.shadow;
	context.globalAlpha = 0.32;
	context.fill();
	context.restore();

	// Pin body
	context.save();
	context.beginPath();
	context.arc(pinX, pinY, pinR, 0, Math.PI * 2);
	context.fillStyle = pin.head;
	context.shadowBlur = 12;
	context.shadowColor = pin.shadow;
	context.fill();
	context.restore();

	// Pin specular highlight (3D sphere effect)
	context.save();
	const specGrad = context.createRadialGradient(
		pinX - pinR * 0.3,
		pinY - pinR * 0.38,
		0,
		pinX,
		pinY,
		pinR,
	);
	specGrad.addColorStop(0, "rgba(255, 255, 255, 0.75)");
	specGrad.addColorStop(0.38, "rgba(255, 255, 255, 0.22)");
	specGrad.addColorStop(1, "rgba(0, 0, 0, 0)");
	context.beginPath();
	context.arc(pinX, pinY, pinR, 0, Math.PI * 2);
	context.fillStyle = specGrad;
	context.fill();
	context.restore();

	// Pin rim
	context.save();
	context.beginPath();
	context.arc(pinX, pinY, pinR, 0, Math.PI * 2);
	context.lineWidth = 1.6;
	context.strokeStyle = pin.rim;
	context.globalAlpha = 0.55;
	context.stroke();
	context.restore();

	context.restore(); // end tilt transform
}

function findMemoNodeHit(
	interactions: BrainCanvasInteractionState,
	px: number,
	py: number,
) {
	return [...interactions.nodes]
		.sort((left, right) => right.radius - left.radius)
		.find((node) => pointInBrainNode(px, py, node));
}

function useBrainCanvasRenderer({
	canvasRef,
	projectedGraph,
	selectedNodeId,
	centerMemoId,
	viewport = defaultBrainViewport,
	interactionRef,
	hoveredMemoId = null,
	highlightedMemoId = null,
	visualMode = "signal_cluster",
	settleToken = 0,
	positionOverrides,
}: {
	canvasRef: { current: HTMLCanvasElement | null };
	projectedGraph: BrainGraphProjection;
	selectedNodeId: number | null;
	centerMemoId: number | null;
	viewport?: BrainViewportState;
	interactionRef: { current: BrainCanvasInteractionState };
	hoveredMemoId?: number | null;
	highlightedMemoId?: number | null;
	visualMode?: BrainVisualMode;
	settleToken?: number;
	positionOverrides?: ReadonlyMap<number, BrainStoredPosition | null>;
}) {
	useEffect(() => {
		const canvas = canvasRef.current;
		if (!canvas) {
			return;
		}
		void settleToken;
		const settleDuration =
			getBrainVariantStyle(visualMode).motion.settleDurationMs;
		canvas.classList.remove("brain-node-settle");
		void canvas.offsetWidth;
		canvas.classList.add("brain-node-settle");
		const timer = window.setTimeout(() => {
			canvas.classList.remove("brain-node-settle");
		}, settleDuration);
		return () => {
			window.clearTimeout(timer);
			canvas.classList.remove("brain-node-settle");
		};
	}, [canvasRef, settleToken, visualMode]);

	useEffect(() => {
		const canvas = canvasRef.current;
		if (!canvas) {
			return;
		}

		let rafId = 0;
		let isActive = true;
		let bgCanvas: HTMLCanvasElement | null = null;
		let bgWidth = 0;
		let bgHeight = 0;

		const paint = (time: number) => {
			if (!isActive) return;
			const rect = canvas.getBoundingClientRect();
			if (rect.width <= 0 || rect.height <= 0) {
				rafId = requestAnimationFrame(paint);
				return;
			}

			const dpr = window.devicePixelRatio || 1;
			const targetW = Math.floor(rect.width * dpr);
			const targetH = Math.floor(rect.height * dpr);
			if (canvas.width !== targetW || canvas.height !== targetH) {
				canvas.width = targetW;
				canvas.height = targetH;
			}

			const context = canvas.getContext("2d");
			if (!context) return;

			const rootStyles = getComputedStyle(canvas);
			const geometry = getBrainVariantGeometry(visualMode);
			const style = getBrainVariantStyle(visualMode);

			// Re-render static cork background only when size changes
			if (!bgCanvas || bgWidth !== targetW || bgHeight !== targetH) {
				bgCanvas = document.createElement("canvas");
				bgCanvas.width = targetW;
				bgCanvas.height = targetH;
				bgWidth = targetW;
				bgHeight = targetH;
				const bgCtx = bgCanvas.getContext("2d");
				if (bgCtx) {
					bgCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
					drawOrganicBackdrop(bgCtx, rect.width, rect.height, style);
				}
			}

			context.setTransform(dpr, 0, 0, dpr, 0, 0);
			context.clearRect(0, 0, rect.width, rect.height);
			if (bgCanvas) {
				context.drawImage(bgCanvas, 0, 0, rect.width, rect.height);
			} else {
				drawOrganicBackdrop(context, rect.width, rect.height, style);
			}

			const metrics = resolveBrainCanvasMetrics(rect.width, rect.height);
			const layout = layoutBrainNodes({
				nodes: projectedGraph.nodes,
				width: metrics.contentWidth,
				height: metrics.contentHeight,
				variant: visualMode,
				positionOverrides,
			});
			const toScreen = (x: number, y: number) => {
				return toBrainCanvasScreenPoint(metrics, viewport, x, y);
			};
			const centerLayout =
				(centerMemoId !== null ? layout.get(centerMemoId) : null) ??
				layout.get(projectedGraph.nodes[0]?.id ?? "__missing__");
			const sceneOrigin = centerLayout
				? toScreen(centerLayout.x, centerLayout.y)
				: { x: rect.width / 2, y: rect.height / 2 };

				const basin = context.createRadialGradient(
					sceneOrigin.x,
					sceneOrigin.y,
					20,
					sceneOrigin.x,
					sceneOrigin.y,
					Math.max(rect.width, rect.height) * 0.46,
				);
				basin.addColorStop(0, "rgba(232, 180, 90, 0.14)");
				basin.addColorStop(0.52, "rgba(129, 158, 205, 0.08)");
				basin.addColorStop(1, "rgba(0, 0, 0, 0)");
				context.fillStyle = basin;
				context.fillRect(0, 0, rect.width, rect.height);

				const edgeInteractions: BrainCanvasEdgeHit[] = [];
			for (const edge of projectedGraph.edges) {
				const from = layout.get(edge.fromId);
				const to = layout.get(edge.toId);
				if (!from || !to) {
					continue;
				}
				const fromAnchor = getNodeAnchor(from, to.x, to.y);
				const toAnchor = getNodeAnchor(to, from.x, from.y);
				const fromScreen = toScreen(fromAnchor.x, fromAnchor.y);
				const toScreenPos = toScreen(toAnchor.x, toAnchor.y);
				const highlighted =
					highlightedMemoId !== null &&
					(edge.fromId === highlightedMemoId || edge.toId === highlightedMemoId);
				const curve = buildNeuralCurve(
					fromScreen,
					toScreenPos,
					sceneOrigin,
					style.edge.curveBend + (highlighted ? 0.04 : 0),
				);
				const points = sampleCurvePoints(curve);
				const midPoint = points[Math.floor(points.length / 2)] ?? fromScreen;
				const yarnPalette = style.palette.yarns[edge.yarnColor];
				const baseWidth = Math.max(
					2.6,
					(highlighted ? geometry.highlightEdgeWidth : geometry.baseEdgeWidth) *
						viewport.zoom,
				);
				// Twisted thread with time-based gentle sway animation
				drawTwistedYarn(
					context,
					points,
					yarnPalette,
					baseWidth,
					highlighted,
					time,
					edge.memoAId * 1.618 + edge.memoBId * 0.927,
				);

				edgeInteractions.push({
					edge,
					points,
					midPoint,
					highlighted,
				});
			}

			const candidateNodeCount = projectedGraph.nodes.filter(
				(node) => node.kind === "candidate",
			).length;
			const connectedNodeCount = projectedGraph.nodes.filter(
				(node) => node.kind === "connected",
			).length;
			canvas.dataset.edgeCount = String(edgeInteractions.length);
			canvas.dataset.connectedEdgeCount = String(edgeInteractions.length);
			canvas.dataset.candidateNodeCount = String(candidateNodeCount);
			canvas.dataset.connectedNodeCount = String(connectedNodeCount);
			canvas.dataset.brainMode = visualMode;
			if (edgeInteractions.length > 0) {
				const first = edgeInteractions[0];
				canvas.dataset.edgeMidX = String(first.midPoint.x);
				canvas.dataset.edgeMidY = String(first.midPoint.y);
			} else {
				delete canvas.dataset.edgeMidX;
				delete canvas.dataset.edgeMidY;
			}

			const nodeInteractions: BrainCanvasNodeHit[] = [];
			for (const node of projectedGraph.nodes) {
				const position = layout.get(node.id);
				if (!position) {
					continue;
				}
				const screen = toScreen(position.x, position.y);
				const width = Math.max(
					node.kind === "center" ? 180 : node.kind === "connected" ? 150 : 126,
					position.width * viewport.zoom,
				);
				const height = Math.max(
					node.kind === "center" ? 138 : node.kind === "connected" ? 114 : 96,
					position.height * viewport.zoom,
				);
				const borderRadius = Math.min(position.borderRadius * viewport.zoom, 24);
				const radius = Math.max(width, height) / 2;
				const isSelected = node.memoId !== null && node.memoId === selectedNodeId;
				const isHovered = node.memoId !== null && node.memoId === hoveredMemoId;
				const isFocusNeighbor =
					highlightedMemoId !== null && node.memoId === highlightedMemoId;
				const visualState: BrainNodeVisualState =
					node.kind === "center"
						? "center"
						: isSelected
							? "selected"
							: isHovered
								? "hovered"
								: isFocusNeighbor
									? "focus-neighbor"
									: node.kind;
				const palette =
					node.kind === "center"
						? style.node.center
						: node.kind === "connected"
							? style.node.connected
							: node.kind === "candidate"
								? style.node.candidate
								: style.node.overflow;
				const stroke =
					node.kind === "center"
						? style.node.center.stroke
						: isSelected
							? style.node.selected.stroke
							: isHovered
								? style.node.selected.stroke
								: isFocusNeighbor
									? style.node.focusNeighbor.stroke
									: palette.stroke;
				const halo =
					node.kind === "center"
						? style.node.center.halo
						: isSelected
							? style.node.selected.halo
							: isHovered
								? "rgba(170, 206, 255, 0.28)"
								: isFocusNeighbor
									? style.node.focusNeighbor.halo
									: palette.halo;
				const shadow =
					node.kind === "center"
						? style.node.center.shadow
						: isSelected
							? style.node.selected.shadow
							: isHovered
								? "rgba(112, 168, 255, 0.4)"
								: isFocusNeighbor
									? style.node.focusNeighbor.shadow
									: palette.shadow;
				const lineWidth =
					node.kind === "center"
						? 2.4
						: isSelected || isHovered || isFocusNeighbor
							? 2.15
							: 1.2;
				const paperPalette = style.palette.notes[node.tone];
				const pinPalette = style.palette.pins[node.pinColor];

				drawOrganicNode(context, {
					x: screen.x,
					y: screen.y,
					width,
					height,
					borderRadius,
					shape: position.shape,
					paper: paperPalette,
					pin: pinPalette,
					stroke,
					halo,
					shadow,
					lineWidth,
					isCandidate: node.kind === "candidate",
					isCenter: node.kind === "center",
					nodeId: typeof node.id === "number" ? node.id : 0,
				});

				const label = truncateLabel(
					node.title,
					node.kind === "center"
						? geometry.labelMaxCenter
						: geometry.labelMaxNode,
				);
				const meta =
					node.memoId !== null
						? projectedGraph.nodeMeta.get(node.memoId)
						: undefined;
				const metaLabel =
					node.kind === "center" ? `연결 ${node.connectedCount}` : "";
				const fontSize =
					node.kind === "center"
						? Math.max(14, 15.5 * viewport.zoom)
						: Math.max(12.5, 12.4 * viewport.zoom);
				const labelFontFamily =
					rootStyles.getPropertyValue("--brain-label-font").trim() ||
					'"Space Grotesk","Pretendard",ui-sans-serif,system-ui';
				context.textBaseline = "middle";
				context.textAlign = "left";
				context.fillStyle = paperPalette.text;
				context.font = `700 ${fontSize}px ${labelFontFamily}`;
				context.fillText(
					label,
					screen.x - width / 2 + 18,
					screen.y - height / 2 + 44,
				);
				context.font = `500 ${Math.max(10, 9.2 * viewport.zoom)}px ${labelFontFamily}`;
				context.fillStyle = paperPalette.mutedText;
				const previewLines = wrapStickyPreview(
					context,
					node.contentPreview,
					width - 32,
				);
				previewLines.forEach((line, index) => {
					context.fillText(
						line,
						screen.x - width / 2 + 18,
						screen.y - height / 2 + 68 + index * 20,
					);
				});
				if (node.kind === "center") {
					context.font = `600 ${Math.max(10, 9 * viewport.zoom)}px ${labelFontFamily}`;
					context.fillText(
						metaLabel,
						screen.x - width / 2 + 18,
						screen.y + height / 2 - 18,
					);
				}

				if (node.memoId !== null && meta) {
					const badgeColor =
						meta.recencyBucket === "today"
							? "#ffd47d"
							: meta.recencyBucket === "week"
								? "#9ec9ff"
								: "#5f759d";
					context.save();
					context.beginPath();
					context.arc(
						screen.x + width / 2 - 11,
						screen.y - height / 2 + 11,
						node.kind === "center" ? 4.5 : 3.5,
						0,
						Math.PI * 2,
					);
					context.fillStyle = badgeColor;
					context.shadowBlur = 8;
					context.shadowColor = badgeColor;
					context.fill();
					context.restore();
				}

				nodeInteractions.push({
					id: node.id,
					memoId: node.memoId,
					x: screen.x,
					y: screen.y,
					layoutX: position.x,
					layoutY: position.y,
					layoutWidth: position.width,
					layoutHeight: position.height,
					width,
					height,
					borderRadius,
					radius,
					shape: position.shape,
					visualState,
				});
			}

			const tappableNode = nodeInteractions.find(
				(node) => node.memoId !== null && node.memoId !== centerMemoId,
			);
			if (tappableNode) {
				canvas.dataset.nodeTapX = String(tappableNode.x);
				canvas.dataset.nodeTapY = String(tappableNode.y);
			} else {
				delete canvas.dataset.nodeTapX;
				delete canvas.dataset.nodeTapY;
			}

			const selectedNode =
				selectedNodeId !== null
					? nodeInteractions.find(
							(node) => node.memoId !== null && node.memoId === selectedNodeId,
						)
					: undefined;
			const selectedLayout =
				selectedNodeId !== null ? layout.get(selectedNodeId) : undefined;
			if (selectedNode && selectedLayout) {
				canvas.dataset.selectedNodeScreenX = String(selectedNode.x);
				canvas.dataset.selectedNodeScreenY = String(selectedNode.y);
				canvas.dataset.selectedNodePositionX = String(
					selectedLayout.x / metrics.contentWidth,
				);
				canvas.dataset.selectedNodePositionY = String(
					selectedLayout.y / metrics.contentHeight,
				);
			} else {
				delete canvas.dataset.selectedNodeScreenX;
				delete canvas.dataset.selectedNodeScreenY;
				delete canvas.dataset.selectedNodePositionX;
				delete canvas.dataset.selectedNodePositionY;
			}

			const currentInteractions = interactionRef.current;
			if (!currentInteractions) {
				return;
			}
			currentInteractions.nodes = nodeInteractions;
			currentInteractions.edges = edgeInteractions;
			// Schedule next frame for animated thread sway
			if (projectedGraph.edges.length > 0 && isActive) {
				rafId = requestAnimationFrame(paint);
			}
		};
		rafId = requestAnimationFrame(paint);
		return () => {
			isActive = false;
			cancelAnimationFrame(rafId);
		};
	}, [
		canvasRef,
		projectedGraph,
		selectedNodeId,
		centerMemoId,
		viewport,
		interactionRef,
		hoveredMemoId,
		highlightedMemoId,
		visualMode,
		positionOverrides,
	]);
}

function BrainCanvasPanel({
	mode,
	designVariant,
	chromeDensity,
	centerMemo,
	memos,
	onConnectMemo,
	onDisconnectMemo,
	onPersistBrainPosition,
	onOpenMemo,
}: {
	mode: "desktop" | "mobile-sheet";
	designVariant: MemoDesignVariant;
	chromeDensity: BrainChromeDensity;
	centerMemo: MemoRecord;
	memos: MemoRecord[];
	onConnectMemo: (payload: { memoAId: number; memoBId: number }) => void;
	onDisconnectMemo: (payload: { memoAId: number; memoBId: number }) => void;
	onPersistBrainPosition: (payload: {
		id: number;
		x: number | null;
		y: number | null;
	}) => void;
	onOpenMemo: (memoId: number) => void;
}) {
	const [searchTerm, setSearchTerm] = useState("");
	const [graphCenterId, setGraphCenterId] = useState(centerMemo.id);
	const [selectedNodeId, setSelectedNodeId] = useState<number | null>(
		centerMemo.id,
	);
	const [viewport, setViewport] =
		useState<BrainViewportState>(defaultBrainViewport);
	const [settleToken, setSettleToken] = useState(0);
	const [trailState, setTrailState] = useState<{
		items: BrainTrailItem[];
		index: number;
	}>({
		items: [{ centerId: centerMemo.id, timestamp: Date.now() }],
		index: 0,
	});

	useEffect(() => {
		setGraphCenterId(centerMemo.id);
		setSelectedNodeId(centerMemo.id);
		setSearchTerm("");
		setViewport(defaultBrainViewport);
		setSettleToken((previous) => previous + 1);
		setTrailState({
			items: [{ centerId: centerMemo.id, timestamp: Date.now() }],
			index: 0,
		});
	}, [centerMemo.id]);

	const memoMap = useMemo(() => {
		const next = new Map<number, MemoRecord>();
		for (const memo of memos) {
			next.set(memo.id, memo);
		}
		return next;
	}, [memos]);

	const graphCenterMemo = memoMap.get(graphCenterId) ?? centerMemo;
	const nodeLimit = mode === "mobile-sheet" ? 24 : 36;
	const panelCompact = chromeDensity === "minimal";
	const canGoBack = trailState.index > 0;
	const canGoForward = trailState.index < trailState.items.length - 1;
	const {
		canvasRef,
		projectedGraph,
		selectedGraphMemo,
		selectedConnectionStatus,
		isSelectedConnected,
		handleCanvasPointerDown,
		handleCanvasPointerMove,
		handleCanvasPointerUp,
		handleCanvasPointerCancel,
		handleCanvasWheel,
		handleCanvasLeave,
		selectNodeById,
	} = useBrainCanvasScene({
		memos,
		activeCenterMemo: graphCenterMemo,
		nodeLimit,
		searchTerm,
		selectedNodeId,
		setSelectedNodeId,
		viewport,
		setViewport,
		onPersistBrainPosition,
		designVariant,
		settleToken,
	});
	const panelNodes = projectedGraph.nodes
		.filter((node) => node.memoId !== null)
		.slice(0, mode === "mobile-sheet" ? 8 : 10);
	const commandButtonClass =
		"inline-flex min-h-10 items-center rounded-[var(--memo-radius-control)] border border-[var(--memo-workbench-line)] bg-[var(--memo-workbench-panel)] px-3 text-[12px] font-semibold text-[#2a3c52] transition hover:border-[#8ea0bd] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] disabled:cursor-not-allowed disabled:opacity-45";

	const handleCenterSelected = () => {
		if (!selectedGraphMemo) {
			return;
		}
		setTrailState((previous) => {
			const activeCenter = previous.items[previous.index]?.centerId ?? null;
			if (activeCenter === selectedGraphMemo.id) {
				return previous;
			}
			const nextItems = previous.items.slice(0, previous.index + 1);
			nextItems.push({
				centerId: selectedGraphMemo.id,
				timestamp: Date.now(),
			});
			return {
				items: nextItems.slice(-20),
				index: Math.min(nextItems.length, 20) - 1,
			};
		});
		setGraphCenterId(selectedGraphMemo.id);
		setSelectedNodeId(selectedGraphMemo.id);
		setViewport(defaultBrainViewport);
		setSettleToken((previous) => previous + 1);
	};

	const handleTrailBack = () => {
		setTrailState((previous) => {
			if (previous.index <= 0) {
				return previous;
			}
			const nextIndex = previous.index - 1;
			const nextCenterId = previous.items[nextIndex]?.centerId ?? null;
			if (nextCenterId !== null) {
				setGraphCenterId(nextCenterId);
				setSelectedNodeId(nextCenterId);
				setViewport(defaultBrainViewport);
				setSettleToken((current) => current + 1);
			}
			return {
				...previous,
				index: nextIndex,
			};
		});
	};

	const handleTrailForward = () => {
		setTrailState((previous) => {
			if (previous.index >= previous.items.length - 1) {
				return previous;
			}
			const nextIndex = previous.index + 1;
			const nextCenterId = previous.items[nextIndex]?.centerId ?? null;
			if (nextCenterId !== null) {
				setGraphCenterId(nextCenterId);
				setSelectedNodeId(nextCenterId);
				setViewport(defaultBrainViewport);
				setSettleToken((current) => current + 1);
			}
			return {
				...previous,
				index: nextIndex,
			};
		});
	};

	const handleOpenSelected = () => {
		if (!selectedGraphMemo) {
			return;
		}
		onOpenMemo(selectedGraphMemo.id);
	};

	const handleConnectSelected = () => {
		if (!selectedGraphMemo || selectedGraphMemo.id === graphCenterMemo.id) {
			return;
		}
		onConnectMemo({
			memoAId: graphCenterMemo.id,
			memoBId: selectedGraphMemo.id,
		});
	};

	const handleDisconnectSelected = () => {
		if (!selectedGraphMemo || selectedGraphMemo.id === graphCenterMemo.id) {
			return;
		}
		onDisconnectMemo({
			memoAId: graphCenterMemo.id,
			memoBId: selectedGraphMemo.id,
		});
	};

	return (
		<div
			className={cn("space-y-3", panelCompact && "space-y-2")}
			data-testid="memo-brain-panel"
			data-memo-theme={designVariant}
			data-brain-node-shape={brainNodeShape}
		>
			<div
				className="flex flex-wrap items-center gap-2"
				data-testid="memo-brain-command-rail"
			>
				<input
					type="text"
					value={searchTerm}
					onChange={(event) => setSearchTerm(event.target.value)}
					placeholder="노트 탐색"
					className="h-10 min-w-[10rem] flex-1 rounded-[var(--memo-radius-control)] border border-[var(--memo-workbench-line)] bg-[var(--memo-workbench-panel)] px-3 text-sm text-[#203146] placeholder:text-[#6a7b94] focus:outline-none focus-visible:ring-4 focus-visible:ring-[var(--focus-ring)]"
					data-testid="memo-brain-search"
				/>
				<button
					type="button"
					onClick={handleTrailBack}
					disabled={!canGoBack}
					className={commandButtonClass}
					data-testid="memo-brain-back"
				>
					뒤로
				</button>
				<button
					type="button"
					onClick={handleTrailForward}
					disabled={!canGoForward}
					className={commandButtonClass}
					data-testid="memo-brain-forward"
				>
					앞으로
				</button>
			</div>

			<div className="overflow-hidden rounded-[var(--memo-radius-panel)] border border-[var(--memo-workbench-line)] bg-[var(--memo-workbench-muted)] p-2 shadow-[var(--memo-shadow-rail)]">
				<canvas
					ref={canvasRef}
					width={640}
					height={320}
					className={cn(
						"w-full cursor-grab touch-none rounded-[var(--memo-radius-control)] bg-transparent",
						mode === "mobile-sheet" ? "h-56" : "h-64",
					)}
					onPointerDown={handleCanvasPointerDown}
					onPointerMove={handleCanvasPointerMove}
					onPointerUp={handleCanvasPointerUp}
					onPointerCancel={handleCanvasPointerCancel}
					onPointerLeave={handleCanvasLeave}
					onWheel={handleCanvasWheel}
					onDoubleClick={() => setViewport(defaultBrainViewport)}
					data-testid="memo-brain-canvas"
				/>
			</div>

			<div
				className={cn(
					"grid gap-3",
					mode === "desktop" &&
						"lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]",
				)}
			>
				<div className="rounded-[var(--memo-radius-panel)] border border-[var(--memo-workbench-line)] bg-[var(--memo-workbench-panel)] p-3 text-[#203146] shadow-[var(--memo-shadow-rail)] backdrop-blur-sm">
					<div className="flex items-start justify-between gap-3">
						<div>
							<p className="text-[12px] font-medium tracking-[0.14em] text-[#71829a]">
								SELECTION
							</p>
							<p className="mt-1 text-sm font-semibold text-[#203146]">
								{selectedGraphMemo?.title ?? "선택된 노드 없음"}
							</p>
						</div>
						<button
							type="button"
							onClick={() => setViewport(defaultBrainViewport)}
							className="inline-flex min-h-8 items-center rounded-[var(--memo-radius-chip)] border border-[var(--memo-workbench-line)] bg-[var(--memo-workbench-panel)] px-2.5 text-[12px] font-medium text-[#62748d] transition hover:border-[#8ea0bd] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
						>
							뷰 리셋
						</button>
					</div>
					<div className="mt-2 flex flex-wrap items-center gap-2">
						<span className="inline-flex h-7 items-center rounded-[var(--memo-radius-chip)] bg-[#eef1d7] px-2.5 text-[12px] font-medium text-[#617231]">
							{selectedConnectionStatus}
						</span>
						<span className="inline-flex h-7 items-center rounded-[var(--memo-radius-chip)] bg-[#edf3fb] px-2.5 text-[12px] font-medium text-[#4d688f]">
							연결 {selectedGraphMemo?.connected_ids.length ?? 0}
						</span>
						<span className="inline-flex h-7 items-center rounded-[var(--memo-radius-chip)] bg-[#edf1f6] px-2.5 text-[12px] font-medium text-[#62748d]">
							Zoom {viewport.zoom.toFixed(2)}
						</span>
					</div>
					<p
						className="mt-3 text-xs text-[#62748d]"
						data-testid="memo-brain-selection-status"
					>
						보이는 연결 {projectedGraph.centerMetrics.connectedVisibleCount} ·
						후보 {projectedGraph.centerMetrics.candidateVisibleCount}
					</p>
					<div className="mt-3 flex flex-wrap gap-2">
						<BrainSelectionActions
							selectedGraphMemo={selectedGraphMemo}
							centerMemo={graphCenterMemo}
							isSelectedConnected={isSelectedConnected}
							onCenterSelected={handleCenterSelected}
							onOpenSelected={handleOpenSelected}
							onConnectSelected={handleConnectSelected}
							onDisconnectSelected={handleDisconnectSelected}
							compact
						/>
					</div>
				</div>

				<div className="rounded-[var(--memo-radius-panel)] border border-[var(--memo-workbench-line)] bg-[var(--memo-workbench-panel)] p-3 text-[#203146] shadow-[var(--memo-shadow-rail)] backdrop-blur-sm">
					<div className="flex items-center justify-between gap-2">
						<p className="text-[12px] font-medium tracking-[0.14em] text-[#71829a]">
							VISIBLE NODES
						</p>
						<span className="text-[12px] font-medium text-[#71829a]">
							{panelNodes.length} visible
						</span>
					</div>
					<BrainVisibleNodeList
						nodes={panelNodes}
						selectedNodeId={selectedNodeId}
						selectNodeById={selectNodeById}
						className="mt-3"
					/>
				</div>
			</div>
		</div>
	);
}

function OrganizeHub({
	mode,
	designVariant,
	tab,
	onTabChange,
	onClose,
	tags,
	tagUsageCounts,
	selectedTagFilters,
	onToggleTagFilter,
	tagInput,
	onTagInputChange,
	onCreateTag,
	onRenameTag,
	onDeleteTag,
	selectedMemo,
	memos,
	brainChromeDensity,
	onConnectMemo,
	onDisconnectMemo,
	onPersistBrainPosition,
	onOpenMemo,
	smartView,
	smartViewCounts,
	onSmartViewChange,
	sortValue,
	onSortChange,
	toneFilter,
	onToneFilterChange,
	filterAccordion,
	onToggleFilterAccordion,
	onResetFilters,
	isFiltersAtDefault,
}: {
	mode: "desktop" | "mobile-sheet";
	designVariant: MemoDesignVariant;
	tab: OrganizeTab;
	onTabChange: (tab: OrganizeTab) => void;
	onClose: () => void;
	tags: Array<{ id: number; name: string }>;
	tagUsageCounts: Map<number, number>;
	selectedTagFilters: number[];
	onToggleTagFilter: (tagId: number) => void;
	tagInput: string;
	onTagInputChange: (value: string) => void;
	onCreateTag: () => void;
	onRenameTag: (tagId: number, name: string) => void;
	onDeleteTag: (tagId: number) => void;
	selectedMemo: MemoRecord | null;
	memos: MemoRecord[];
	brainChromeDensity: BrainChromeDensity;
	onConnectMemo: (payload: { memoAId: number; memoBId: number }) => void;
	onDisconnectMemo: (payload: { memoAId: number; memoBId: number }) => void;
	onPersistBrainPosition: (payload: {
		id: number;
		x: number | null;
		y: number | null;
	}) => void;
	onOpenMemo: (memoId: number) => void;
	smartView: SmartView;
	smartViewCounts: Record<SmartView, number>;
	onSmartViewChange: (smartView: SmartView) => void;
	sortValue: MemoSort;
	onSortChange: (sort: MemoSort) => void;
	toneFilter: MemoTone | undefined;
	onToneFilterChange: (tone: MemoTone | undefined) => void;
	filterAccordion: FilterAccordionState;
	onToggleFilterAccordion: (section: FilterAccordionSection) => void;
	onResetFilters: () => void;
	isFiltersAtDefault: boolean;
}) {
	const [renameDrafts, setRenameDrafts] = useState<Record<number, string>>({});

	useEffect(() => {
		setRenameDrafts(
			Object.fromEntries(tags.map((tag) => [tag.id, tag.name])) as Record<
				number,
				string
			>,
		);
	}, [tags]);

	return (
		<div
			className="flex h-full min-h-0 flex-col"
			data-memo-theme={designVariant}
		>
			<div className="flex items-center justify-between border-b border-[var(--memo-workbench-line)] px-4 py-3">
				<div>
					<p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--text-tertiary)]">
						정리함
					</p>
					<p className="mt-1 text-xs text-[var(--text-secondary)]">
						태그와 연결을 한 번에 정리합니다
					</p>
				</div>
				<div className="flex items-center gap-2">
					{tab === "filters" ? (
						<>
							<span className="sr-only" data-testid="memo-filters-reset-state">
								{isFiltersAtDefault ? "비활성" : "활성"}
							</span>
							<button
								type="button"
								onClick={onResetFilters}
								disabled={isFiltersAtDefault}
								data-testid="memo-filters-reset"
								data-state={isFiltersAtDefault ? "disabled" : "enabled"}
								className="inline-flex h-9 items-center justify-center rounded-[var(--memo-radius-control)] border border-[var(--memo-workbench-line)] bg-[var(--memo-workbench-panel)] px-3 text-xs font-semibold uppercase tracking-[0.1em] text-[var(--text-secondary)] transition hover:border-[var(--border-strong)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] disabled:cursor-not-allowed disabled:opacity-45"
							>
								초기화
							</button>
						</>
					) : null}
					<button
						type="button"
						onClick={onClose}
						className="inline-flex h-9 items-center justify-center rounded-[var(--memo-radius-control)] border border-[var(--memo-workbench-line)] bg-[var(--memo-workbench-panel)] px-3 text-xs font-semibold uppercase tracking-[0.1em] text-[var(--text-secondary)] transition hover:border-[var(--border-strong)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
					>
						닫기
					</button>
				</div>
			</div>

			<div className="flex items-center gap-2 border-b border-[var(--memo-workbench-line)] px-4 py-3">
				<button
					type="button"
					onClick={() => onTabChange("tags")}
					className={cn(
						"inline-flex min-h-10 items-center rounded-[var(--memo-radius-control)] border px-3 text-xs font-semibold uppercase tracking-[0.11em] transition focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]",
						tab === "tags"
							? "border-[var(--accent)] bg-[var(--accent)] text-white"
							: "border-[var(--memo-workbench-line)] bg-[var(--memo-workbench-panel)] text-[var(--text-secondary)]",
					)}
					data-testid="memo-organize-tab-tags"
				>
					태그
				</button>
				<button
					type="button"
					onClick={() => onTabChange("filters")}
					className={cn(
						"inline-flex min-h-10 items-center rounded-[var(--memo-radius-control)] border px-3 text-xs font-semibold uppercase tracking-[0.11em] transition focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]",
						tab === "filters"
							? "border-[var(--accent)] bg-[var(--accent)] text-white"
							: "border-[var(--memo-workbench-line)] bg-[var(--memo-workbench-panel)] text-[var(--text-secondary)]",
					)}
					data-testid="memo-organize-tab-filters"
				>
					필터
				</button>
			</div>

			<div
				className={cn(
					"min-h-0 flex-1 overflow-y-auto p-4",
					mode === "mobile-sheet" && "pb-8",
				)}
			>
				{tab === "tags" ? (
					<div className="space-y-3" data-testid="memo-organize-tags-panel">
						<div className="flex gap-2">
							<input
								type="text"
								value={tagInput}
								onChange={(event) => onTagInputChange(event.target.value)}
								onKeyDown={(event) => {
									if (event.key === "Enter") {
										event.preventDefault();
										onCreateTag();
									}
								}}
								placeholder="태그 만들기"
								className="h-10 flex-1 rounded-[var(--memo-radius-control)] border border-[var(--memo-workbench-line)] bg-[var(--memo-workbench-panel)] px-3 text-sm text-[var(--text-primary)] focus:outline-none focus-visible:ring-4 focus-visible:ring-[var(--focus-ring)]"
								data-testid="memo-organize-tag-create-input"
							/>
							<button
								type="button"
								onClick={onCreateTag}
								className="inline-flex h-10 items-center justify-center rounded-[var(--memo-radius-control)] border border-[var(--memo-workbench-line)] bg-[var(--memo-workbench-panel)] px-4 text-xs font-semibold uppercase tracking-[0.1em] text-[var(--text-secondary)] transition hover:border-[var(--border-strong)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
								data-testid="memo-organize-tag-create-submit"
							>
								추가
							</button>
						</div>

						{tags.length > 0 ? (
							<ul className="space-y-2">
								{tags.map((tag) => {
									const activeFilter = selectedTagFilters.includes(tag.id);
									const usageCount = tagUsageCounts.get(tag.id) ?? 0;
									const draft = renameDrafts[tag.id] ?? tag.name;
									return (
										<li
											key={tag.id}
											className="rounded-[var(--memo-radius-panel)] border border-[var(--memo-workbench-line)] bg-[var(--memo-workbench-panel)] p-3"
										>
											<div className="flex items-center justify-between gap-2">
												<button
													type="button"
													onClick={() => onToggleTagFilter(tag.id)}
													className={cn(
														"inline-flex min-h-8 items-center rounded-[var(--memo-radius-control)] border px-3 text-xs font-semibold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]",
														activeFilter
															? "border-[var(--accent)] bg-[var(--accent)] text-white"
															: "border-[var(--memo-workbench-line)] bg-[var(--memo-workbench-panel)] text-[var(--text-secondary)]",
													)}
													data-testid={`memo-organize-tag-filter-${tag.id}`}
												>
													#{tag.name}
												</button>
												<span className="text-[11px] font-semibold uppercase tracking-[0.1em] text-[var(--text-tertiary)]">
													{usageCount}개 메모
												</span>
											</div>

											<div className="mt-2 flex gap-2">
												<input
													type="text"
													value={draft}
													onChange={(event) =>
														setRenameDrafts((previous) => ({
															...previous,
															[tag.id]: event.target.value,
														}))
													}
													className="h-9 flex-1 rounded-[var(--memo-radius-control)] border border-[var(--memo-workbench-line)] bg-[var(--memo-workbench-panel)] px-3 text-sm text-[var(--text-primary)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
												/>
												<button
													type="button"
													onClick={() => onRenameTag(tag.id, draft)}
													className="inline-flex h-9 items-center justify-center rounded-[var(--memo-radius-control)] border border-[var(--memo-workbench-line)] bg-[var(--memo-workbench-panel)] px-3 text-[11px] font-semibold uppercase tracking-[0.1em] text-[var(--text-secondary)] transition hover:border-[var(--border-strong)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
												>
													이름 바꾸기
												</button>
												<button
													type="button"
													onClick={() => onDeleteTag(tag.id)}
													className="inline-flex h-9 items-center justify-center rounded-[var(--memo-radius-control)] border border-[#c77f8d] bg-[#fdf2f5] px-3 text-[11px] font-semibold uppercase tracking-[0.1em] text-[#7d2435] transition hover:bg-[#fbe8ed] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
													data-testid={`memo-organize-tag-delete-${tag.id}`}
												>
													삭제
												</button>
											</div>
										</li>
									);
								})}
							</ul>
						) : (
							<p className="text-sm text-[var(--text-secondary)]">
								아직 태그가 없어요. 관련 메모를 더 빨리 묶으려면 태그를 만들어 보세요.
							</p>
						)}
					</div>
				) : (
					<div className="space-y-3" data-testid="memo-organize-filters-panel">
						<div
							className="rounded-[var(--memo-radius-panel)] border border-[var(--memo-workbench-line)] bg-[var(--memo-workbench-panel)]"
							data-testid="memo-filters-section-smart-views"
						>
							<button
								type="button"
								onClick={() => onToggleFilterAccordion("smartViews")}
								className="flex w-full items-center justify-between px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-[0.11em] text-[var(--text-secondary)]"
								data-testid="memo-filters-toggle-smartViews"
								aria-expanded={filterAccordion.smartViews}
							>
								<span>스마트 뷰</span>
								<span>{filterAccordion.smartViews ? "닫기" : "열기"}</span>
							</button>
							{filterAccordion.smartViews ? (
								<div className="grid gap-2 p-3">
									{secondarySmartViews.map((view) => (
										<button
											type="button"
											key={view}
											onClick={() => onSmartViewChange(view)}
											disabled={view === "related" && !selectedMemo}
											data-testid={`memo-filter-smart-view-${view}`}
											className={cn(
												"flex min-h-10 items-center justify-between rounded-[var(--memo-radius-control)] border px-3 text-xs font-semibold uppercase tracking-[0.1em] transition focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] disabled:cursor-not-allowed disabled:opacity-45",
												smartView === view
													? "border-[var(--accent)] bg-[var(--accent)] text-white"
													: "border-[var(--memo-workbench-line)] bg-[var(--memo-workbench-panel)] text-[var(--text-secondary)] hover:border-[var(--border-strong)]",
											)}
										>
											<span>{smartViewLabels[view]}</span>
											<span
												className={cn(
													"inline-flex min-h-5 min-w-5 items-center justify-center rounded-[var(--memo-radius-chip)] px-1 text-[10px] font-semibold",
													smartView === view
														? "bg-white/20 text-white"
														: "bg-[var(--memo-workbench-muted)] text-[var(--text-secondary)]",
												)}
											>
												{smartViewCounts[view]}
											</span>
										</button>
									))}
								</div>
							) : null}
						</div>

						<div
							className="rounded-[var(--memo-radius-panel)] border border-[var(--memo-workbench-line)] bg-[var(--memo-workbench-panel)]"
							data-testid="memo-filters-section-sort"
						>
							<button
								type="button"
								onClick={() => onToggleFilterAccordion("sort")}
								className="flex w-full items-center justify-between px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-[0.11em] text-[var(--text-secondary)]"
								data-testid="memo-filters-toggle-sort"
								aria-expanded={filterAccordion.sort}
							>
								<span>정렬</span>
								<span>{filterAccordion.sort ? "닫기" : "열기"}</span>
							</button>
							{filterAccordion.sort ? (
								<div className="flex flex-wrap gap-2 p-3">
									{sortOptions.map((option) => (
										<button
											type="button"
											key={option.value}
											onClick={() => onSortChange(option.value)}
											data-testid={`memo-filter-sort-${option.value}`}
											className={cn(
												"inline-flex min-h-10 items-center rounded-[var(--memo-radius-control)] border px-3 text-xs font-semibold uppercase tracking-[0.1em] transition focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]",
												sortValue === option.value
													? "border-[var(--accent)] bg-[var(--accent)] text-white"
													: "border-[var(--memo-workbench-line)] bg-[var(--memo-workbench-panel)] text-[var(--text-secondary)] hover:border-[var(--border-strong)]",
											)}
										>
											{option.label}
										</button>
									))}
								</div>
							) : null}
						</div>

						<div
							className="rounded-[var(--memo-radius-panel)] border border-[var(--memo-workbench-line)] bg-[var(--memo-workbench-panel)]"
							data-testid="memo-filters-section-tone"
						>
							<button
								type="button"
								onClick={() => onToggleFilterAccordion("tone")}
								className="flex w-full items-center justify-between px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-[0.11em] text-[var(--text-secondary)]"
								data-testid="memo-filters-toggle-tone"
								aria-expanded={filterAccordion.tone}
							>
								<span>톤</span>
								<span>{filterAccordion.tone ? "닫기" : "열기"}</span>
							</button>
							{filterAccordion.tone ? (
								<div className="flex flex-wrap gap-2 p-3">
									<button
										type="button"
										onClick={() => onToneFilterChange(undefined)}
										data-testid="memo-filter-tone-all"
										className={cn(
											"inline-flex min-h-10 items-center gap-2 rounded-[var(--memo-radius-control)] border px-3 text-xs font-semibold uppercase tracking-[0.1em] transition focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]",
											toneFilter === undefined
												? "border-[var(--accent)] bg-[var(--accent)] text-white"
												: "border-[var(--memo-workbench-line)] bg-[var(--memo-workbench-panel)] text-[var(--text-secondary)] hover:border-[var(--border-strong)]",
										)}
									>
										전체
									</button>
									{toneOptions.map((tone) => (
										<button
											type="button"
											key={tone.key}
											onClick={() => onToneFilterChange(tone.key)}
											data-testid={`memo-filter-tone-${tone.key}`}
											className={cn(
												"inline-flex min-h-10 items-center gap-2 rounded-[var(--memo-radius-control)] border px-3 text-xs font-semibold uppercase tracking-[0.1em] transition focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]",
												toneFilter === tone.key
													? "border-[var(--accent)] bg-[var(--accent)] text-white"
													: "border-[var(--memo-workbench-line)] bg-[var(--memo-workbench-panel)] text-[var(--text-secondary)] hover:border-[var(--border-strong)]",
											)}
										>
											<span
												className={cn(
													"h-2.5 w-2.5 rounded-full",
													tone.dotClass,
												)}
											/>
											{tone.label}
										</button>
									))}
								</div>
							) : null}
						</div>

						<div
							className="rounded-[var(--memo-radius-panel)] border border-[var(--memo-workbench-line)] bg-[var(--memo-workbench-panel)]"
							data-testid="memo-filters-section-tags"
						>
							<button
								type="button"
								onClick={() => onToggleFilterAccordion("tags")}
								className="flex w-full items-center justify-between px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-[0.11em] text-[var(--text-secondary)]"
								data-testid="memo-filters-toggle-tags"
								aria-expanded={filterAccordion.tags}
							>
								<span>태그</span>
								<span>{filterAccordion.tags ? "닫기" : "열기"}</span>
							</button>
							{filterAccordion.tags ? (
								<div className="flex flex-wrap gap-2 p-3">
									{tags.length > 0 ? (
										tags.map((tag) => {
											const active = selectedTagFilters.includes(tag.id);
											return (
												<button
													type="button"
													key={tag.id}
													onClick={() => onToggleTagFilter(tag.id)}
													className={cn(
														"inline-flex min-h-10 items-center rounded-[var(--memo-radius-control)] border px-3 text-xs font-semibold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]",
														active
															? "border-[var(--accent)] bg-[var(--accent)] text-white"
															: "border-[var(--memo-workbench-line)] bg-[var(--memo-workbench-panel)] text-[var(--text-secondary)] hover:border-[var(--border-strong)]",
													)}
												>
													#{tag.name}
												</button>
											);
										})
									) : (
										<p className="text-sm text-[var(--text-secondary)]">
											아직 만든 태그가 없어요.
										</p>
									)}
								</div>
							) : null}
						</div>
					</div>
				)}
			</div>
		</div>
	);
}

function SaveBadge({ state }: { state: SaveState }) {
	const label =
		state === "saving"
			? "저장 중"
			: state === "saved"
				? "저장됨"
				: state === "error"
					? "오류"
					: "대기 중";

	return (
		<span
			className={cn(
				"inline-flex min-h-8 items-center rounded-[var(--memo-radius-chip)] px-3 text-[11px] font-semibold uppercase tracking-[0.08em]",
				state === "saved" && "bg-emerald-100 text-emerald-700",
				state === "saving" && "bg-amber-100 text-amber-700",
				state === "error" && "bg-rose-100 text-rose-700",
				state === "idle" &&
					"bg-[var(--surface-muted)] text-[var(--text-secondary)]",
			)}
			data-testid="memo-editor-save-badge"
		>
			{label}
		</span>
	);
}

function getMemoSnippet(content: string) {
	return content.replace(/\s+/g, " ").trim() || "메모 내용을 적어보세요";
}

function formatDateTime(date: number) {
	return new Intl.DateTimeFormat("ko-KR", {
		month: "short",
		day: "2-digit",
		year: "numeric",
		hour: "2-digit",
		minute: "2-digit",
	}).format(new Date(date));
}

function formatMiniDate(date: number) {
	return new Intl.DateTimeFormat("ko-KR", {
		month: "short",
		day: "2-digit",
		hour: "2-digit",
		minute: "2-digit",
	}).format(new Date(date));
}
