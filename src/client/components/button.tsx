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
	return (
		<button
			type="button"
			title={title}
			className="p-2 rounded-full hover:bg-gray-200"
			{...props}
		>
			{icon}
		</button>
	);
}
