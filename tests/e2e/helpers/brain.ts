import { expect, type Locator, type Page } from "@playwright/test";
import { createFirstMemo } from "./auth";

function escapeRegExp(value: string) {
	return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

async function visibleByTestId(page: Page, testId: string) {
	return page.locator(`[data-testid="${testId}"]:visible`).first();
}

export async function expectFullscreenBrainShell(page: Page) {
	const shell = page.getByTestId("memo-brain-canvas-shell");
	await expect(shell).toBeVisible();
	const viewport = page.viewportSize();
	const bounds = await shell.boundingBox();
	if (!viewport || !bounds) {
		throw new Error("Viewport or fullscreen shell bounds are unavailable");
	}

	expect(Math.abs(bounds.x)).toBeLessThanOrEqual(2);
	expect(Math.abs(bounds.y)).toBeLessThanOrEqual(2);
	expect(bounds.width).toBeGreaterThanOrEqual(viewport.width - 2);
	expect(bounds.height).toBeGreaterThanOrEqual(viewport.height - 2);
}

export async function expectBrainAtlas(page: Page) {
	await expect(page.getByTestId("memo-page-root")).toBeVisible();
	await expect(page.getByTestId("memo-brain-home")).toBeVisible();
	await expect(page.getByTestId("memo-toolbar")).toHaveCount(0);
	await expect(page.getByTestId("memo-brain-global-rail")).toBeVisible();
	await expect(page.getByTestId("memo-global-search")).toBeVisible();
	await expect(page.getByTestId("memo-create-sticky")).toBeVisible();
	await expect(page.getByTestId("memo-organize-trigger")).toBeVisible();
	await expect(page.getByTestId("memo-filters-open")).toBeVisible();
	await expectFullscreenBrainShell(page);
	await expect(page.getByTestId("memo-home-mode-brain")).toHaveCount(0);
	await expect(page.getByTestId("memo-home-mode-list")).toHaveCount(0);
}

export async function openBrainListPanel(page: Page) {
	const panel = page.getByTestId("memo-brain-list-panel");
	const toggle = page.getByTestId("memo-brain-toggle-list-panel");
	if ((await panel.count()) === 0) {
		await toggle.click({ force: true });
		await page.waitForTimeout(120);
		if ((await panel.count()) === 0) {
			await toggle.dispatchEvent("click");
		}
	}
	await expect(panel).toBeVisible();
	return panel;
}

export async function closeBrainListPanel(page: Page) {
	const panel = page.getByTestId("memo-brain-list-panel");
	if ((await panel.count()) === 0) {
		return;
	}
	await page.getByTestId("memo-brain-toggle-list-panel").click();
	await expect(panel).toHaveCount(0);
}

export async function getVisibleEditor(page: Page): Promise<Locator> {
	const isMobileViewport = (page.viewportSize()?.width ?? 0) < 1024;
	const mobileSheet = page.getByTestId("memo-mobile-editor-sheet");
	if (isMobileViewport) {
		await expect(mobileSheet).toBeVisible();
		return mobileSheet;
	}

	const desktopDock = page.getByTestId("memo-brain-context-dock");
	await expect(desktopDock).toBeVisible();
	return desktopDock;
}

export async function waitForEditorSaved(page: Page) {
	const editor = await getVisibleEditor(page);
	const saveBadge = editor.getByTestId("memo-editor-save-badge");
	await expect(saveBadge).toBeVisible();
	await expect(saveBadge).toHaveText("저장됨", { timeout: 5_000 });
}

export async function createSticky(
	page: Page,
	{
		title,
		content = "",
	}: {
		title: string;
		content?: string;
	},
) {
	const toolbarCreate = await visibleByTestId(page, "memo-create-sticky");
	if ((await toolbarCreate.count()) > 0) {
		await toolbarCreate.click();
	} else {
		await createFirstMemo(page);
	}

	const editor = await getVisibleEditor(page);
	const titleInput = editor.getByTestId("memo-editor-title");
	const contentInput = editor.getByTestId("memo-editor-textarea");
	await expect(titleInput).toHaveValue("제목 없는 메모");
	await expect(contentInput).toHaveValue("");
	await titleInput.fill(title);
	await contentInput.click();
	await waitForEditorSaved(page);

	if (content.length > 0) {
		await contentInput.fill(content);
		await editor.getByTestId("memo-editor-title").click();
		await waitForEditorSaved(page);
	}

	return editor;
}

export async function closeMobileEditorIfOpen(page: Page) {
	const sheet = page.getByTestId("memo-mobile-editor-sheet");
	if ((await sheet.count()) === 0) {
		return;
	}

	const backdrop = page.getByTestId("memo-sheet-backdrop");
	if ((await backdrop.count()) > 0) {
		await backdrop.click({ position: { x: 18, y: 18 }, force: true });
	}

	if ((await sheet.count()) > 0) {
		await dragSheetHandle(page, 900);
	}
	await expect(sheet).toHaveCount(0);
}

export async function dragSheetHandle(page: Page, deltaY: number) {
	const handle = page.getByTestId("memo-sheet-drag-handle");
	await expect(handle).toBeVisible();
	const box = await handle.boundingBox();
	if (!box) {
		throw new Error("Sheet drag handle bounds are unavailable");
	}

	const startX = box.x + box.width / 2;
	const startY = box.y + box.height / 2;
	await page.mouse.move(startX, startY);
	await page.mouse.down();
	await page.mouse.move(startX, startY + deltaY, { steps: 10 });
	await page.mouse.up();
	await page.waitForTimeout(220);
}

export async function selectMemoFromBrain(
	page: Page,
	title: string,
	options: { search?: boolean; waitForEditor?: boolean } = {},
) {
	if (options.search !== false) {
		const search = await visibleByTestId(page, "memo-brain-search");
		await expect(search).toBeVisible();
		await search.fill(title);
	}

	const panel = await openBrainListPanel(page);
	const memoButton = panel
		.getByRole("button", {
			name: new RegExp(escapeRegExp(title), "i"),
		})
		.first();
	await expect(memoButton).toBeVisible();
	await memoButton.click();

	if (options.waitForEditor !== false) {
		const isMobileViewport = (page.viewportSize()?.width ?? 0) < 1024;
		if (!isMobileViewport) {
			const desktopDock = page.getByTestId("memo-brain-context-dock");
			const selectedToggle = page.getByTestId(
				"memo-brain-toggle-selected-panel",
			);
			if ((await desktopDock.count()) === 0) {
				await selectedToggle.click({ force: true });
				await page.waitForTimeout(120);
				if ((await desktopDock.count()) === 0) {
					await selectedToggle.dispatchEvent("click");
				}
			}
			await expect(desktopDock).toBeVisible();
		}
		await expect(page.getByTestId("memo-editor-title").first()).toBeVisible();
	}

	return memoButton;
}

export async function openColorPalette(page: Page) {
	const editor = await getVisibleEditor(page);
	const toggle = editor.getByTestId("memo-editor-color-toggle");
	if (
		(await toggle.count()) > 0 &&
		(await toggle.getAttribute("aria-expanded")) !== "true"
	) {
		await toggle.click();
	}
	return editor;
}

export async function activatePaletteTone(
	root: Locator,
	palette: "post-it-color" | "pin-color" | "yarn",
	tone: "neutral" | "sun" | "peach" | "violet" | "aqua" | "lime",
) {
	await root.getByTestId(`memo-palette-${palette}-${tone}`).click();
}

export async function expectPaletteToneActive(
	root: Locator,
	palette: "post-it-color" | "pin-color" | "yarn",
	tone: "neutral" | "sun" | "peach" | "violet" | "aqua" | "lime",
) {
	await expect(root.getByTestId(`memo-palette-${palette}-${tone}`)).toHaveClass(
		/text-white/,
	);
}

export async function getCanvasTapPosition(page: Page) {
	const canvas = page.getByTestId("memo-brain-canvas");
	await expect(canvas).toBeVisible();
	const box = await canvas.boundingBox();
	const tapX = Number(await canvas.getAttribute("data-node-tap-x"));
	const tapY = Number(await canvas.getAttribute("data-node-tap-y"));
	if (!box || !Number.isFinite(tapX) || !Number.isFinite(tapY)) {
		throw new Error("Canvas tap coordinates are unavailable");
	}
	return {
		x: box.x + tapX,
		y: box.y + tapY,
	};
}

export async function tapFirstCanvasNode(page: Page) {
	const point = await getCanvasTapPosition(page);
	await page.mouse.click(point.x, point.y);
}
