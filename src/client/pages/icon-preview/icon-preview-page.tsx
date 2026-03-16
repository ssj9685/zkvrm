import { Icon, iconNames } from "../../components/icons/icon";

export function IconPreviewPage() {
	return (
		<div className="relative min-h-screen px-4 py-6">
			<div className="mx-auto w-full max-w-6xl">
				<div className="mb-5 rounded-[1.4rem] border border-[var(--border-soft)] bg-white/92 p-5 shadow-[var(--shadow-soft)]">
					<h1
						className="text-3xl tracking-tight text-[var(--text-primary)]"
						style={{ fontFamily: "var(--font-display)" }}
					>
						Icon Preview
					</h1>
					<p className="mt-2 max-w-xl text-sm leading-relaxed text-[var(--text-secondary)]">
						Reference set used across the product surfaces.
					</p>
				</div>

				<div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
					{iconNames.map((name) => (
						<div
							key={name}
							className="group flex flex-col items-center rounded-[var(--radius-md)] border border-[var(--border-soft)] bg-white/88 p-4 shadow-[var(--shadow-soft)] transition-[transform,box-shadow] duration-[var(--motion-fast)] hover:-translate-y-0.5 hover:shadow-[var(--shadow-card)]"
						>
							<Icon
								name={name}
								className="mb-2 h-12 w-12 text-[var(--text-secondary)]"
								title={name}
							/>
							<span className="text-center text-sm text-[var(--text-secondary)]">
								{name}
							</span>
						</div>
					))}
				</div>
			</div>
		</div>
	);
}
