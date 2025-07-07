import { useStore } from "@ga-ut/store";
import { useEffect, useState } from "react";
import { memoStore } from "@/domains/memo";
import { Button } from "@/shared/components/Button";
import { ArrowLeftIcon } from "@/shared/components/icons/arrow-left-icon";
import { DownloadIcon } from "@/shared/components/icons/download-icon";
import { FilePlusIcon } from "@/shared/components/icons/file-plus-icon";
import { SaveIcon } from "@/shared/components/icons/save-icon";
import { Trash2Icon } from "@/shared/components/icons/trash-2-icon";

const handleDownload = async () => {
	const response = await fetch("/api/memo/download");
	const blob = await response.blob();
	const url = window.URL.createObjectURL(blob);
	const a = document.createElement("a");
	a.href = url;
	a.download = "memos.txt.gz";
	document.body.appendChild(a);
	a.click();
	a.remove();
};

export function MemoPage() {
	const { create, refresh } = useStore(memoStore);
	const handleNewMemo = async () => {
		create({ content: "New memo" });
	};

	useEffect(() => {
		refresh();
	}, []);

	return (
		<div className="p-4">
			<div className="flex justify-between items-center mb-4">
				<h1 className="text-2xl font-bold">ZKVRM</h1>
				<div className="flex items-center gap-2">
					<Button
						icon={FilePlusIcon}
						title="New Memo"
						onClick={handleNewMemo}
					/>
					<Button
						icon={DownloadIcon}
						title="Download All Memos"
						onClick={handleDownload}
					/>
				</div>
			</div>
			<MemoList />
		</div>
	);
}

function MemoList() {
	const { memos } = useStore(memoStore);

	if (!memos || memos.length === 0) {
		return <p>No memos yet. Create one!</p>;
	}

	return (
		<div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
			{memos.map((memo) => (
				<MemoItem key={memo.id} memo={memo} />
			))}
		</div>
	);
}

function MemoItem({ memo }: { memo: { id: number; content: string } }) {
	const [selected, setSelected] = useState(false);
	const [currentContent, setCurrentContent] = useState(memo.content);
	const { update, remove } = useStore(memoStore);

	const handleSave = async () => {
		if (memo.content === currentContent) {
			setSelected(false);
			return;
		}
		update({ id: memo.id, content: currentContent });
		setSelected(false);
	};

	const handleDelete = () => {
		remove({ id: memo.id });
	};

	if (selected) {
		return (
			<div className="fixed inset-0 bg-white p-4 z-10">
				<div className="flex justify-between items-center mb-4">
					<ArrowLeftIcon
						className="cursor-pointer text-gray-600 hover:text-gray-900 w-6 h-6"
						onClick={() => setSelected(false)}
					/>
					<div className="flex items-center gap-2">
						<Button icon={Trash2Icon} title="Delete" onClick={handleDelete} />
						<Button icon={SaveIcon} title="Save" onClick={handleSave} />
					</div>
				</div>
				<textarea
					className="w-full h-[calc(100%-50px)] border rounded p-2"
					value={currentContent}
					onChange={(e) => setCurrentContent(e.target.value)}
				/>
			</div>
		);
	}

	return (
		<button
			type="button"
			onClick={() => setSelected(true)}
			className="block w-full h-32 p-4 border rounded-lg text-left hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-gray-500 overflow-hidden"
		>
			<p className="text-gray-800 whitespace-pre-wrap break-words">
				{memo.content}
			</p>
		</button>
	);
}
