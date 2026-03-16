import { cn } from "@client/lib/utils/cn";
import type React from "react";
import type { ButtonHTMLAttributes, DetailedHTMLProps } from "react";

interface FormButtonProps
	extends DetailedHTMLProps<
		ButtonHTMLAttributes<HTMLButtonElement>,
		HTMLButtonElement
	> {
	children: React.ReactNode;
}

export function FormButton({ children, ...props }: FormButtonProps) {
	const { className, ...buttonProps } = props;

	return (
		<button
			type="submit"
			className={cn(
				"inline-flex h-13 w-full items-center justify-center rounded-[1.1rem_1.4rem_1rem_1.35rem] border border-[rgb(188_94_73/0.42)] bg-[linear-gradient(135deg,var(--accent)_0%,var(--accent-strong)_100%)] px-5 text-sm font-semibold tracking-[0.02em] text-[rgb(255_251_245)] shadow-[0_22px_34px_-24px_rgba(34,50,74,0.55)] transition-[transform,filter,box-shadow] duration-[var(--motion-base)]",
				"hover:-translate-y-1 hover:rotate-[0.8deg] hover:brightness-105 focus:outline-none focus-visible:ring-4 focus-visible:ring-[var(--focus-ring)] active:translate-y-0",
				disabledButtonClass(buttonProps.disabled),
				className,
			)}
			{...buttonProps}
		>
			{children}
		</button>
	);
}

function disabledButtonClass(disabled?: boolean) {
	if (!disabled) {
		return "";
	}

	return "cursor-not-allowed opacity-45 hover:translate-y-0 hover:brightness-100";
}
