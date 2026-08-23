"use client";

import { cn } from "@client/lib/utils/cn";
import { createOverlayStore, OverlaySpace } from "@client/lib/utils/overlay";
import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";

const store = createOverlayStore();
const overlay = store.getState();

export const toast = {
	open(text: string) {
		overlay.open({
			element: ({ isOpen, close, unmount }) => {
				const handleClose = () => {
					close();
					setTimeout(unmount, 1000);
				};

				return <Toast isOpen={isOpen} onClose={handleClose} text={text} />;
			},
		});
	},
};

export function ToastSpace() {
	return <OverlaySpace store={store} />;
}

function ToastInner({
	isOpen,
	onClose,
	children,
}: {
	children: React.ReactNode;
	isOpen: boolean;
	onClose: () => void;
}) {
	const touchStartY = useRef<number | null>(null);
	const touchEndY = useRef<number | null>(null);

	useEffect(() => {
		const timeout = setTimeout(() => {
			onClose();
		}, 2700);
		return () => clearTimeout(timeout);
	}, [onClose]);

	const handleTouchStart = (e: React.TouchEvent) => {
		touchStartY.current = e.touches[0].clientY;
	};
	const handleTouchMove = (e: React.TouchEvent) => {
		touchEndY.current = e.touches[0].clientY;
	};
	const handleTouchEnd = () => {
		if (
			touchStartY.current !== null &&
			touchEndY.current !== null &&
			touchEndY.current - touchStartY.current > 50
		) {
			onClose();
		}
	};
	const handleClick = () => {
		onClose();
	};

	return (
		<button
			type="button"
			tabIndex={0}
			className={cn(
				"fixed bottom-8 left-1/2 -translate-x-1/2 rotate-[-1.6deg] rounded-[1.1rem_1.45rem_1rem_1.35rem] border border-[var(--border-strong)] bg-[linear-gradient(180deg,rgba(255,249,239,0.98)_0%,rgba(255,240,225,0.98)_100%)] px-5 py-3 text-sm font-semibold text-[var(--accent-strong)] opacity-0 shadow-[var(--shadow-board)] transition-all duration-300",
				isOpen && "opacity-100",
			)}
			onTouchStart={handleTouchStart}
			onTouchMove={handleTouchMove}
			onTouchEnd={handleTouchEnd}
			onClick={handleClick}
		>
			{children}
		</button>
	);
}

export function Toast({
	isOpen,
	onClose,
	text,
}: {
	isOpen: boolean;
	text: React.ReactNode;
	onClose: () => void;
}) {
	return createPortal(
		<ToastInner isOpen={isOpen} onClose={onClose}>
			{text}
		</ToastInner>,
		document.body,
	);
}
