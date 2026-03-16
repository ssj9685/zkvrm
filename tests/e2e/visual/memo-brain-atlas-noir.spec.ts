import { expect, test } from "@playwright/test";
import {
	closeMobileEditorIfOpen,
	expectBrainAtlas,
	openBrainListPanel,
	openMemoByTitle,
	prepareVisualWorkspace,
} from "./helpers/memo-brain-visual";

const visualThreshold = 0.0015;
const isPlaywrightRuntime = process.argv.some((arg) =>
	arg.toLowerCase().includes("playwright"),
);

if (isPlaywrightRuntime) {
	test.describe("memo brain visual post-it atlas", () => {
		test("captures sticky atlas baselines", async ({ page }) => {
			await prepareVisualWorkspace(page);

			await page.setViewportSize({ width: 1280, height: 800 });
			await expectBrainAtlas(page);
			await openMemoByTitle(page, "Alpha");
			await closeMobileEditorIfOpen(page);
			await expect(
				page.getByTestId("memo-brain-canvas-shell"),
			).toHaveScreenshot("atlas-noir-scene-01-desktop-atlas.png", {
				maxDiffPixelRatio: visualThreshold,
			});

			await openMemoByTitle(page, "Beta");
			await expect(page.getByTestId("memo-brain-context-dock")).toBeVisible();
			await expect(
				page.getByTestId("memo-brain-canvas-shell"),
			).toHaveScreenshot("atlas-noir-scene-02-desktop-selected.png", {
				maxDiffPixelRatio: visualThreshold,
			});

			await openBrainListPanel(page);
			await expect(
				page.getByTestId("memo-brain-canvas-shell"),
			).toHaveScreenshot("atlas-noir-scene-03-desktop-list-panel.png", {
				maxDiffPixelRatio: visualThreshold,
			});

			await page.setViewportSize({ width: 390, height: 844 });
			await expectBrainAtlas(page);
			await closeMobileEditorIfOpen(page);
			await expect(
				page.getByTestId("memo-brain-canvas-shell"),
			).toHaveScreenshot("atlas-noir-scene-04-mobile-atlas.png", {
				maxDiffPixelRatio: visualThreshold,
			});

			await openMemoByTitle(page, "Beta");
			await expect(
				page.getByTestId("memo-mobile-editor-sheet"),
			).toHaveScreenshot("atlas-noir-scene-05-mobile-sheet.png", {
				maxDiffPixelRatio: visualThreshold,
				mask: [page.getByTestId("memo-editor-updated-at")],
			});
		});
	});
}
