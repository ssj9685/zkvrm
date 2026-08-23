import { expect, test } from "@playwright/test";
import {
	activatePaletteTone,
	closeMobileEditorIfOpen,
	createSticky,
	dragSheetHandle,
	expectBrainAtlas,
	expectPaletteToneActive,
	getVisibleEditor,
	openColorPalette,
	selectMemoFromBrain,
	waitForEditorSaved,
} from "./helpers/brain";
import { signUpAndSignIn } from "./helpers/auth";

const isPlaywrightRuntime = process.argv.some((arg) =>
	arg.toLowerCase().includes("playwright"),
);

if (isPlaywrightRuntime) {
	test.describe("memo mobile brain atlas", () => {
		test.beforeEach(async ({ page }) => {
			await page.setViewportSize({ width: 390, height: 844 });
			await signUpAndSignIn(page);
			await expectBrainAtlas(page);
		});

		test("opens directly in Brain atlas and selected nodes open a sticky sheet", async ({
			page,
		}) => {
			await createSticky(page, { title: "Alpha", content: "Alpha content" });
			const sheet = page.getByTestId("memo-mobile-editor-sheet");
			await expect(sheet).toHaveAttribute("data-sheet-snap", "mid");

			await closeMobileEditorIfOpen(page);
			await expect(sheet).toHaveCount(0);

			await selectMemoFromBrain(page, "Alpha");
			await expect(sheet).toBeVisible();

			await dragSheetHandle(page, 900);
			await expect(sheet).toHaveCount(0);
		});

		test("persists title, body, post-it color, and pin color in the mobile sheet", async ({
			page,
		}) => {
			await createSticky(page, {
				title: "Palette note",
				content: "Colorful sticky content",
			});
			let editor = await openColorPalette(page);
			await activatePaletteTone(editor, "post-it-color", "peach");
			await activatePaletteTone(editor, "pin-color", "aqua");

			await closeMobileEditorIfOpen(page);
			await selectMemoFromBrain(page, "Palette note");
			editor = await openColorPalette(page);

			await expect(editor.getByTestId("memo-editor-title")).toHaveValue(
				"Palette note",
			);
			await expect(editor.getByTestId("memo-editor-textarea")).toHaveValue(
				"Colorful sticky content",
			);
			await expectPaletteToneActive(editor, "post-it-color", "peach");
			await expectPaletteToneActive(editor, "pin-color", "aqua");
		});

		test("connects the selected sheet to the center sticky with a yarn color", async ({
			page,
		}) => {
			await createSticky(page, { title: "Alpha", content: "Anchor" });
			await closeMobileEditorIfOpen(page);

			let editor = await createSticky(page, { title: "Beta", content: "Leaf" });
			editor = await openColorPalette(page);
			await activatePaletteTone(editor, "yarn", "lime");
			await editor.getByTestId("memo-brain-connect-selected").click();
			await waitForEditorSaved(page);

			await closeMobileEditorIfOpen(page);
			await selectMemoFromBrain(page, "Beta");
			editor = await openColorPalette(page);

			await expect(
				editor.getByTestId("memo-editor-connection-status"),
			).toHaveText("연결됨");
			await expectPaletteToneActive(editor, "yarn", "lime");
		});

		test("keeps the mobile sheet editable after reopening the same sticky from the board", async ({
			page,
		}) => {
			await createSticky(page, { title: "Reopen me", content: "Editable" });
			await closeMobileEditorIfOpen(page);

			await selectMemoFromBrain(page, "Reopen me");
			const editor = await getVisibleEditor(page);
			await editor.getByTestId("memo-editor-textarea").fill("Editable again");
			await waitForEditorSaved(page);

			await closeMobileEditorIfOpen(page);
			await selectMemoFromBrain(page, "Reopen me");
			await expect(page.getByTestId("memo-editor-textarea")).toHaveValue(
				"Editable again",
			);
		});
	});
}
