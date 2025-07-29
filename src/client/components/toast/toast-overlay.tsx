"use client";

import { cn } from "@client/lib/utils/cn";
import { createOverlayStore, OverlaySpace } from "@client/lib/utils/overlay";
import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";

const store = createOverlayStore();
const { open: overlayOpen } = store.getState();

export const toast = {
	open(text: string) {
		overlayOpen({
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
				"opacity-0 transition-all fixed bottom-[60px] left-1/2 -translate-x-1/2 bg-gray-800 text-white px-4 py-2 rounded-lg shadow-lg transition-discrete",
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
