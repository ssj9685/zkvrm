import type React from "react";
import href from "../../assets/icons.svg";

export const iconNames = [
	"arrow-left",
	"download",
	"empty-state",
	"file-plus",
	"log-out",
	"more-horizontal",
	"save",
	"search",
	"settings",
	"spinner",
	"trash-2",
	"zkvrm-logo",
] as const;

export type IconName = (typeof iconNames)[number];

interface IconProps extends React.SVGProps<SVGSVGElement> {
	name: IconName;
}

export function Icon({
	name,
	title,
	className,
	...props
}: IconProps & { title: string }) {
	return (
		<svg className={className} {...props}>
			<title className="sr-only">{title}</title>
			<use href={`${href}#icon-${name}`} />
		</svg>
	);
}