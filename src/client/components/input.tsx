import { cn } from "@client/lib/utils/cn";
import type { DetailedHTMLProps, InputHTMLAttributes } from "react";

interface InputProps
	extends DetailedHTMLProps<
		InputHTMLAttributes<HTMLInputElement>,
		HTMLInputElement
	> {
	label: string;
}

export function Input({ label, id, ...props }: InputProps) {
	const inputId = id || label.toLowerCase().replace(/ /g, "-");
	const { className, ...inputProps } = props;

	return (
		<div className="space-y-2.5">
			<label
				htmlFor={inputId}
				className="block font-[var(--font-accent)] text-[11px] uppercase tracking-[0.2em] text-[var(--text-tertiary)]"
			>
				{label}
			</label>
			<input
				id={inputId}
				className={cn(
					"block h-13 w-full rounded-[1rem_1.15rem_0.95rem_1.2rem] border border-[var(--border-soft)] bg-[linear-gradient(180deg,rgba(255,253,247,0.98)_0%,rgba(255,249,239,0.94)_100%)] px-4 text-sm text-[var(--text-primary)] shadow-[inset_0_1px_0_rgba(255,255,255,0.9),var(--shadow-card)] transition-[border-color,box-shadow,background-color,transform] duration-[var(--motion-base)]",
					"placeholder:text-[var(--text-tertiary)] hover:-translate-y-0.5 hover:border-[var(--border-strong)] hover:bg-[var(--surface-elevated)] focus:outline-none focus-visible:border-[var(--accent)] focus-visible:ring-4 focus-visible:ring-[var(--focus-ring)]",
					className,
				)}
				{...inputProps}
			/>
		</div>
	);
}
