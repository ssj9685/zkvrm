export function EmptyStateIcon({
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
			strokeWidth="1"
			strokeLinecap="round"
			strokeLinejoin="round"
			className={className}
		>
			<title className="sr-only">{title}</title>
			{/* A simple, clear representation of an empty document or page */}
			<rect x="4" y="4" width="16" height="16" rx="2" ry="2" />
			<line x1="8" y1="8" x2="16" y2="8" />
			<line x1="8" y1="12" x2="16" y2="12" />
			<line x1="8" y1="16" x2="12" y2="16" />
		</svg>
	);
}
