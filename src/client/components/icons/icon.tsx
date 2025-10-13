import type React from "react";
import spriteUrl from "../../assets/icons.svg";

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
	const symbolId = `icon-${name}`;
	const inlineHref = `#${symbolId}`;
	const fallbackHref = `${spriteUrl}#${symbolId}`;
	const resolvedHref =
		typeof document !== "undefined" && document.getElementById(symbolId)
			? inlineHref
			: fallbackHref;

	return (
		<svg className={className} {...props}>
			<title className="sr-only">{title}</title>
			<use href={resolvedHref} xlinkHref={resolvedHref} />
		</svg>
	);
}
