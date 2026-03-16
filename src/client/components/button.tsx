import { cn } from "@client/lib/utils/cn";
import type { ButtonHTMLAttributes, DetailedHTMLProps } from "react";
import type { Icon } from "./icons/icon";

interface ButtonProps
	extends DetailedHTMLProps<
		ButtonHTMLAttributes<HTMLButtonElement>,
		HTMLButtonElement
	> {
	icon: ReturnType<typeof Icon>;
	title: string;
}

export function Button({ icon, title, name, ...props }: ButtonProps) {
	const { className, ...buttonProps } = props;

	return (
		<button
			type="button"
			title={title}
			className={cn(
				"inline-flex h-11 w-11 items-center justify-center rounded-[1rem_1.2rem_0.95rem_1.15rem] border border-[var(--border-strong)] bg-[linear-gradient(180deg,rgba(255,249,239,0.98)_0%,rgba(243,233,216,0.95)_100%)] text-[var(--accent-strong)] shadow-[var(--shadow-card)] transition-[transform,box-shadow,border-color,background-color] duration-[var(--motion-fast)]",
				"hover:-translate-y-1 hover:rotate-[2deg] hover:border-[var(--accent)] hover:bg-[var(--surface-elevated)] focus:outline-none focus-visible:ring-4 focus-visible:ring-[var(--focus-ring)]",
				"disabled:cursor-not-allowed disabled:opacity-45 disabled:hover:translate-y-0",
				className,
			)}
			{...buttonProps}
		>
			{icon}
		</button>
	);
}
