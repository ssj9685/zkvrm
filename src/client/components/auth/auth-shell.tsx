import { Icon } from "@client/components/icons/icon";
import type { ReactNode } from "react";

interface AuthShellProps {
	title: string;
	subtitle: string;
	badge: string;
	children: ReactNode;
	footer?: ReactNode;
}

const previewNotes = [
	{
		bg: "#fff7ea",
		pin: "#22324a",
		text: "#22324a",
		label: "Flow",
		title: "생각은 먼저 붙여두기",
		copy: "정리보다 빠른 기록이 먼저입니다.",
		angle: -5,
	},
	{
		bg: "#ffe3d7",
		pin: "#e57a61",
		text: "#5d2a21",
		label: "Tape",
		title: "조금 비뚤어도 괜찮기",
		copy: "반듯함보다 손맛이 먼저 보이게 만듭니다.",
		angle: 4,
	},
	{
		bg: "#dff3ec",
		pin: "#8fc8b5",
		text: "#20453a",
		label: "Link",
		title: "연결은 실처럼 보이기",
		copy: "노트와 노트가 한 장의 보드에서 이어집니다.",
		angle: -3,
	},
	{
		bg: "#f7efc4",
		pin: "#e3bf58",
		text: "#544817",
		label: "Mood",
		title: "따뜻하지만 선명하게",
		copy: "종이 톤 위에 잉크 대비를 분명하게 둡니다.",
		angle: 3,
	},
];

export function AuthShell({
	title,
	subtitle,
	badge,
	children,
	footer,
}: AuthShellProps) {
	return (
		<div className="auth-scrapbook-shell relative min-h-screen overflow-hidden px-3 py-4 sm:px-6 sm:py-6">
			<div className="ui-orb-a pointer-events-none absolute left-[-8rem] top-0 h-72 w-72 rounded-full bg-[rgb(229_122_97/0.22)] blur-3xl" />
			<div className="ui-orb-b pointer-events-none absolute right-[-6rem] top-12 h-64 w-64 rounded-full bg-[rgb(143_200_181/0.26)] blur-3xl" />
			<div className="pointer-events-none absolute bottom-[-5rem] left-[18%] h-56 w-56 rounded-full bg-[rgb(227_191_88/0.2)] blur-3xl" />

			<main className="ui-enter relative mx-auto w-full max-w-[1320px]">
				<section className="auth-scrapbook-board relative overflow-hidden">
					<div className="grid min-h-[calc(100vh-2rem)] gap-0 lg:grid-cols-[1.05fr_0.95fr]">
						<aside className="relative hidden min-h-full overflow-hidden border-r border-[var(--border-soft)] px-10 py-10 lg:block xl:px-12 xl:py-12">
							<div className="flex items-start justify-between gap-6">
								<div>
									<div className="ui-sticker-chip">scrapbook atlas</div>
									<h1 className="auth-display mt-6 max-w-[12ch] text-[3.75rem] leading-[0.94] text-[var(--text-primary)] xl:text-[4.6rem]">
										생각이 포스트잇처럼 모이는 작업실
									</h1>
									<p className="mt-5 max-w-xl text-base leading-7 text-[var(--text-secondary)]">
										Tally의 여백과 Mailchimp의 손맛을 섞은 메모판. 빠른 기록,
										느슨한 연결, 살짝 비뚤어진 배치가 한 화면에서 같이 보이도록
										설계합니다.
									</p>
								</div>
								<div className="relative mt-2">
									<div className="grid h-20 w-20 place-items-center rounded-[2rem_2.4rem_1.8rem_2.2rem] border border-[var(--border-strong)] bg-[var(--surface-elevated)] shadow-[var(--shadow-card)]">
										<Icon
											name="zkvrm-logo"
											title="zkvrm"
											className="h-9 w-9 text-[var(--accent-strong)]"
										/>
									</div>
									<span className="auth-tape -left-2 top-2 w-10 rotate-[-9deg]" />
								</div>
							</div>

							<div className="mt-10 grid grid-cols-2 gap-5">
								{previewNotes.map((note, index) => (
									<AuthPreviewCard key={note.title} note={note} index={index} />
								))}
							</div>

							<div className="mt-10 flex flex-wrap items-center gap-3">
								<AuthSticker text="메모" tone="mint" />
								<AuthSticker text="연결" tone="coral" />
								<AuthSticker text="흐름" tone="sun" />
								<AuthSticker text="workspace" tone="paper" />
							</div>

							<div className="mt-12 rounded-[2rem_2.3rem_1.9rem_2.2rem] border border-dashed border-[var(--border-strong)] bg-[rgb(255_249_239/0.62)] px-5 py-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.9)]">
								<p className="font-[var(--font-accent)] text-[11px] uppercase tracking-[0.26em] text-[var(--text-tertiary)]">
									Design direction
								</p>
								<p className="mt-3 text-sm leading-7 text-[var(--text-secondary)]">
									핵심 조작은 차분하고 읽기 쉽게 유지하고, 카드, 스티커, 테이프,
									오버레이, 보드 장식에서만 의도적인 어긋남과 유머를 드러냅니다.
								</p>
							</div>
						</aside>

						<section className="relative flex w-full items-center justify-center px-4 py-8 sm:px-6 sm:py-10 lg:px-10 lg:py-12 xl:px-14">
							<div className="absolute left-4 top-6 hidden lg:block">
								<span className="auth-tape w-16 rotate-[-12deg]" />
							</div>
							<div className="absolute bottom-8 right-5 hidden lg:block">
								<span className="auth-tape w-14 rotate-[10deg]" />
							</div>

							<div className="relative w-full max-w-[34rem]">
								<div className="absolute -left-4 top-5 hidden h-12 w-12 rounded-full border border-[var(--border-strong)] bg-[rgb(255_249_239/0.88)] shadow-[var(--shadow-card)] lg:grid lg:place-items-center">
									<span className="auth-display text-2xl text-[var(--accent-strong)]">
										✦
									</span>
								</div>
								<div className="rounded-[2.2rem_2.7rem_2rem_2.4rem] border border-[var(--border-strong)] bg-[rgb(255_253_247/0.94)] p-5 shadow-[var(--shadow-board)] backdrop-blur-sm sm:p-7">
									<div className="flex items-start justify-between gap-4">
										<div>
											<div className="ui-sticker-chip">{badge}</div>
											<h2 className="auth-display mt-5 text-[3rem] leading-[0.96] text-[var(--text-primary)] sm:text-[3.75rem]">
												{title}
											</h2>
											<p className="mt-4 max-w-[32rem] text-sm leading-7 text-[var(--text-secondary)] sm:text-[15px]">
												{subtitle}
											</p>
										</div>
										<div className="hidden rounded-[1.4rem_1.8rem_1.3rem_1.7rem] border border-[var(--border-soft)] bg-[var(--surface)] px-3 py-2 text-right shadow-[var(--shadow-card)] sm:block">
											<p className="font-[var(--font-accent)] text-[10px] uppercase tracking-[0.24em] text-[var(--text-tertiary)]">
												Ready
											</p>
											<p className="mt-1 text-sm font-semibold text-[var(--text-primary)]">
												작업실 입장
											</p>
										</div>
									</div>

									<div className="auth-form-panel relative mt-8 overflow-hidden rounded-[1.8rem_2rem_1.6rem_2.2rem] border border-[var(--border-soft)] bg-[rgb(255_249_239/0.88)] p-5 shadow-[var(--shadow-card)] sm:p-6">
										<span className="auth-tape left-7 top-0 w-14 rotate-[-8deg]" />
										{children}
									</div>

									{footer ? (
										<div className="mt-6 rounded-[1.2rem_1.5rem_1.1rem_1.4rem] border border-dashed border-[var(--border-soft)] bg-[rgb(255_253_247/0.72)] px-4 py-3 text-sm text-[var(--text-secondary)]">
											{footer}
										</div>
									) : null}
								</div>
							</div>
						</section>
					</div>
				</section>
			</main>
		</div>
	);
}

function AuthPreviewCard({
	note,
	index,
}: {
	note: {
		bg: string;
		pin: string;
		text: string;
		label: string;
		title: string;
		copy: string;
		angle: number;
	};
	index: number;
}) {
	return (
		<div
			className="auth-paper-note relative p-5 shadow-[var(--shadow-card)]"
			style={{
				backgroundColor: note.bg,
				color: note.text,
				transform: `translateY(${index % 2 === 0 ? 0 : 14}px) rotate(${note.angle}deg)`,
			}}
		>
			<span className="auth-tape right-4 top-0 w-12 rotate-[8deg]" />
			<span
				className="mb-4 inline-flex h-4 w-4 rounded-full shadow-sm"
				style={{ backgroundColor: note.pin }}
			/>
			<p className="font-[var(--font-accent)] text-[10px] uppercase tracking-[0.24em] opacity-70">
				{note.label}
			</p>
			<p className="mt-2 text-lg font-semibold leading-tight">{note.title}</p>
			<p className="mt-3 text-sm leading-6 opacity-85">{note.copy}</p>
		</div>
	);
}

function AuthSticker({
	text,
	tone,
}: {
	text: string;
	tone: "mint" | "coral" | "sun" | "paper";
}) {
	const toneClass =
		tone === "mint"
			? "bg-[rgb(223_243_236)] text-[#20453a]"
			: tone === "coral"
				? "bg-[rgb(255_227_215)] text-[#5d2a21]"
				: tone === "sun"
					? "bg-[rgb(247_239_196)] text-[#544817]"
					: "bg-[rgb(255_249_239)] text-[var(--text-primary)]";

	return (
		<span
			className={`inline-flex items-center rounded-[999px] border border-[var(--border-soft)] px-3 py-1.5 font-[var(--font-accent)] text-[10px] uppercase tracking-[0.22em] shadow-[var(--shadow-card)] ${toneClass}`}
		>
			{text}
		</span>
	);
}
