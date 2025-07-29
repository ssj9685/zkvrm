import React, { DetailedHTMLProps, ButtonHTMLAttributes } from "react";

interface FormButtonProps
	extends DetailedHTMLProps<
		ButtonHTMLAttributes<HTMLButtonElement>,
		HTMLButtonElement
	> {
	children: React.ReactNode;
}

export function FormButton({ children, ...props }: FormButtonProps) {
	return (
		<button
			type="submit"
			className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-gray-800 hover:bg-gray-900 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500"
			{...props}
		>
			{children}
		</button>
	);
}
