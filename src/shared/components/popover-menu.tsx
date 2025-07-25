import type React from "react";
import { type ElementType, useEffect, useRef, useState } from "react";
import { Button } from "./button";

interface PopoverMenuProps {
	icon: ElementType;
	title: string;
	children: React.ReactNode;
}

export function PopoverMenu({ icon, title, children }: PopoverMenuProps) {
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
	}, [menuRef]);

	return (
		<div className="relative" ref={menuRef}>
			<Button icon={icon} title={title} onClick={() => setIsOpen(!isOpen)} />
			{isOpen && (
				<div className="absolute right-0 mt-2 w-48 bg-white border border-gray-200 rounded-md shadow-lg z-20">
					{children}
				</div>
			)}
		</div>
	);
}
