import type { Page } from "@playwright/test";
import {
	activatePaletteTone,
	closeMobileEditorIfOpen,
	createSticky,
	expectBrainAtlas,
	openBrainListPanel,
	openColorPalette,
	selectMemoFromBrain,
} from "../../helpers/brain";
import { signUpAndSignIn } from "../../helpers/auth";

export {
	closeMobileEditorIfOpen,
	expectBrainAtlas,
	openBrainListPanel,
	selectMemoFromBrain as openMemoByTitle,
};

export async function prepareVisualWorkspace(page: Page) {
	await page.setViewportSize({ width: 390, height: 844 });
	await signUpAndSignIn(page);
	await expectBrainAtlas(page);

	await createSticky(page, { title: "Alpha", content: "Alpha content" });
	await closeMobileEditorIfOpen(page);

	let editor = await createSticky(page, {
		title: "Beta",
		content: "Beta content",
	});
	editor = await openColorPalette(page);
	await activatePaletteTone(editor, "yarn", "violet");
	await editor.getByTestId("memo-brain-connect-selected").click();
	await closeMobileEditorIfOpen(page);

	await createSticky(page, { title: "Gamma", content: "Gamma content" });
	await closeMobileEditorIfOpen(page);
}
