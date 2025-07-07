export function DownloadIcon({ className, title }: { className?: string, title?: string }) {
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
			{title && <title>{title}</title>}
			<path d="M12 5v14M19 12l-7 7-7-7" />
		</svg>
	);
}
