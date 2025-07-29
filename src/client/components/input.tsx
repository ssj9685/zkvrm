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
	return (
		<div>
			<label htmlFor={inputId} className="text-sm font-medium text-gray-700">
				{label}
			</label>
			<input
				id={inputId}
				className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-gray-500 focus:border-gray-500"
				{...props}
			/>
		</div>
	);
}
