import type {
	ButtonHTMLAttributes,
	DetailedHTMLProps,
	ElementType,
} from "react";

interface ButtonProps
	extends DetailedHTMLProps<
		ButtonHTMLAttributes<HTMLButtonElement>,
		HTMLButtonElement
	> {
	icon: ElementType;
	title: string;
}

export function Button({ icon: Icon, title, ...props }: ButtonProps) {
	return (
		<button
			type="button"
			title={title}
			className="p-2 rounded-full hover:bg-gray-200"
			{...props}
		>
			<Icon className="w-5 h-5" />
		</button>
	);
}
