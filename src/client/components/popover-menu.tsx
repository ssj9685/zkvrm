import type React from "react";
import { useEffect, useRef, useState } from "react";
import { Button } from "./button";
import type { Icon } from "./icons/icon";

interface PopoverMenuProps {
	icon: ReturnType<typeof Icon>;
	title: string;
	children: React.ReactNode;
	triggerTestId?: string;
	menuTestId?: string;
}

export function PopoverMenu({
	icon,
	title,
	children,
	triggerTestId,
	menuTestId,
}: PopoverMenuProps) {
	const [isOpen, setIsOpen] = useState(false);
	const menuRef = useRef<HTMLDivElement>(null);

	useEffect(() => {
		const handleClickOutside = (event: MouseEvent) => {
			if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
				setIsOpen(false);
			}
		};

		document.addEventListener("mousedown", handleClickOutside);
		return () => {
			document.removeEventListener("mousedown", handleClickOutside);
		};
	}, []);

	useEffect(() => {
		const handleEscape = (event: KeyboardEvent) => {
			if (event.key === "Escape") {
				setIsOpen(false);
			}
		};

		document.addEventListener("keydown", handleEscape);
		return () => {
			document.removeEventListener("keydown", handleEscape);
		};
	}, []);

	return (
		<div className="relative" ref={menuRef}>
			<Button
				icon={icon}
				title={title}
				aria-expanded={isOpen}
				aria-haspopup="menu"
				onClick={() => setIsOpen(!isOpen)}
				data-testid={triggerTestId}
			/>
			{isOpen && (
				<div
					className="ui-enter-soft absolute right-0 z-20 mt-3 w-56 overflow-hidden rounded-[1.1rem_1.4rem_1rem_1.35rem] border border-[var(--border-strong)] bg-[linear-gradient(180deg,rgba(255,253,247,0.98)_0%,rgba(255,249,239,0.95)_100%)] shadow-[var(--shadow-board)] backdrop-blur"
					data-testid={menuTestId}
				>
					{children}
				</div>
			)}
		</div>
	);
}
