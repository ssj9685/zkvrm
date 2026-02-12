import { Button } from "@client/components/button";
import { Icon } from "@client/components/icons/icon";
import { PopoverMenu } from "@client/components/popover-menu";
import { toast } from "@client/components/toast/toast-overlay";
import { useDebounceCallback } from "@client/hooks/use-debounce-callback";
import { authStore } from "@client/store/auth";
import { memoStore } from "@client/store/memo";
import { routeStore } from "@client/store/route";
import { useStore } from "@ga-ut/store-react";
import type { MemoRecord } from "@server/api/memo-api";
import { normalizeMemoQuery } from "@shared/memo-query";
import { useEffect, useState } from "react";

const handleDownload = async () => {
	const { blob, filename } = await memoStore.getState().download();
	const url = window.URL.createObjectURL(blob);
	const a = document.createElement("a");
	a.href = url;
	a.download = filename;
	document.body.appendChild(a);
	a.click();
	a.remove();
};

export function MemoPage() {
	const { user, logout } = useStore(authStore);
	const { create, refresh } = useStore(memoStore);
	const router = useStore(routeStore);
	const [searchTerm, setSearchTerm] = useState("");

	const debouncedRefresh = useDebounceCallback((query: string) => {
		refresh(query);
	}, 500);

	const handleNewMemo = async () => {
		create({ content: "New memo" });
	};

	const handleLogout = () => {
		logout();
		router.goto("/sign-in");
	};

	const handleDownloadClick = () => {
		handleDownload();
	};

	const clearSearch = () => {
		debouncedRefresh.cancel();
		setSearchTerm("");
		refresh("");
	};

	useEffect(() => {
		refresh("");
	}, [refresh]);

	return (
		<div className="p-4 relative min-h-screen">
			<div className="flex justify-between items-center mb-4">
				<h1 className="text-xl font-semibold">{user?.username}</h1>
				<PopoverMenu
					icon={<Icon name="settings" className="w-6 h-6" title="Settings" />}
					title="Options"
				>
					<button
						type="button"
						onClick={handleDownloadClick}
						className="flex items-center w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
					>
						<Icon name="download" className="w-4 h-4 mr-2" title="Download" />
						Download
					</button>
					<button
						type="button"
						onClick={handleLogout}
						className="flex items-center w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
					>
						<Icon name="log-out" className="w-4 h-4 mr-2" title="Logout" />
						Logout
					</button>
				</PopoverMenu>
			</div>
			<div className="relative mb-4 w-full sm:w-64">
				<input
					type="text"
					placeholder="Search memos..."
					value={searchTerm}
					onChange={(e) => {
						setSearchTerm(e.target.value);
						debouncedRefresh(e.target.value);
					}}
					onKeyDown={(e) => {
						if (e.key !== "Escape") {
							return;
						}

						clearSearch();
					}}
					className="pl-8 pr-2 py-1 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-gray-500 focus:border-gray-500 w-full"
				/>
				<Icon
					name="search"
					className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400"
					title="Search"
				/>
				{normalizeMemoQuery(searchTerm) ? (
					<button
						type="button"
						onClick={clearSearch}
						className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-gray-500 hover:text-gray-700"
					>
						Clear
					</button>
				) : null}
			</div>
			<MemoList />

			{/* Floating Action Button for New Memo */}
			<button
				type="button"
				title="New Memo"
				onClick={handleNewMemo}
				className="fixed bottom-4 right-4 p-4 rounded-full bg-gray-800 text-white shadow-lg hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500"
			>
				<Icon name="file-plus" className="w-6 h-6" title="New Memo" />
			</button>
		</div>
	);
}

function MemoList() {
	const { memos } = useStore(memoStore);

	if (!memos || memos.length === 0) {
		return (
			<div className="flex flex-col items-center justify-center h-64 text-gray-500">
				<Icon name="empty-state" className="w-12 h-12 mb-4" title="No Memos" />
			</div>
		);
	}

	return (
		<div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
			{memos.map((memo) => (
				<MemoItem key={memo.id} memo={memo} />
			))}
		</div>
	);
}

function MemoItem({ memo }: { memo: MemoRecord }) {
	const [selected, setSelected] = useState(false);
	const [currentContent, setCurrentContent] = useState(memo.content);
	const { update, remove } = useStore(memoStore);

	const debouncedUpdate = useDebounceCallback((content: string) => {
		try {
			update({ id: memo.id, content: content });
		} catch (_) {
			toast.open("Save failed!");
		}
	}, 500);

	const formattedDate = new Date(memo.created_at)
		.toISOString()
		.slice(0, 16)
		.replace("T", " ");

	const handleDelete = () => {
		remove({ id: memo.id });
	};

	if (selected) {
		return (
			<div className="fixed inset-0 bg-white p-4 z-10">
				<div className="flex justify-between items-center mb-4">
					<Icon
						name="arrow-left"
						className="cursor-pointer text-gray-600 hover:text-gray-900 w-6 h-6"
						title="Go Back"
						onClick={() => setSelected(false)}
					/>
					<div className="flex items-center gap-2">
						<Button
							icon={
								<Icon name="trash-2" className="w-4 h-4" title="Delete Memo" />
							}
							title="Delete Memo"
							onClick={handleDelete}
						/>
					</div>
				</div>
				<textarea
					className="w-full h-[calc(100%-50px)] border rounded p-2"
					value={currentContent}
					onChange={(e) => {
						setCurrentContent(e.target.value);
						debouncedUpdate(e.target.value);
					}}
				/>
			</div>
		);
	}

	return (
		<button
			type="button"
			onClick={() => setSelected(true)}
			className="relative block w-full h-32 p-4 border rounded-lg text-left hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-gray-500 overflow-hidden"
		>
			<p className="text-gray-800 whitespace-pre-wrap break-words overflow-hidden line-clamp-3">
				{memo.content}
			</p>
			<div className="absolute bottom-2 right-2 text-xs text-gray-500">
				{formattedDate}
			</div>
		</button>
	);
}
