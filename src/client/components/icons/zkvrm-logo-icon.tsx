export function ZkvrmLogoIcon({
	className,
	title,
}: {
	className?: string;
	title: string;
}) {
	return (
		<svg
			xmlns="http://www.w3.org/2000/svg"
			width="24"
			height="24"
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth="2"
			strokeLinecap="round"
			strokeLinejoin="round"
			className={className}
		>
			<title className="sr-only">{title}</title>
			<path d="M4 14a1 1 0 0 1-1-1L2 9.5a1 1 0 0 1 1-1H6l1-5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1l1 5h4a1 1 0 0 1 1 1l-1 3.5a1 1 0 0 1-1 1h-3l-1 5a1 1 0 0 1-1 1h-4a1 1 0 0 1-1-1l-1-5H4Z" />
		</svg>
	);
}
