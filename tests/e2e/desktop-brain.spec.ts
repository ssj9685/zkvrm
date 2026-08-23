import { expect, type Page, test } from "@playwright/test";
import { signUpAndSignIn } from "./helpers/auth";
import {
	createSticky,
	expectBrainAtlas,
	getVisibleEditor,
	openBrainListPanel,
	selectMemoFromBrain,
} from "./helpers/brain";

async function dragSelectedWindow(page: Page, deltaX: number, deltaY: number) {
	const handle = page.getByTestId("memo-brain-context-dock-drag-handle");
	await expect(handle).toBeVisible();
	const box = await handle.boundingBox();
	if (!box) {
		throw new Error("Selected sticky drag handle is unavailable");
	}

	const startX = box.x + box.width / 2;
	const startY = box.y + Math.min(box.height / 2, 18);
	await page.mouse.move(startX, startY);
	await page.mouse.down();
	await page.mouse.move(startX + deltaX, startY + deltaY, { steps: 12 });
	await page.mouse.up();
	await page.waitForTimeout(200);
}

const isPlaywrightRuntime = process.argv.some((arg) =>
	arg.toLowerCase().includes("playwright"),
);

if (isPlaywrightRuntime) {
	test.describe("memo desktop brain atlas", () => {
		test("floating sticky editor closes, reopens, and keeps manual position", async ({
			page,
		}) => {
			await page.setViewportSize({ width: 1280, height: 820 });
			await signUpAndSignIn(page);
			await expectBrainAtlas(page);

			await createSticky(page, { title: "Alpha", content: "Alpha content" });

			const selectedWindow = page.getByTestId("memo-brain-context-dock");
			await expect(selectedWindow).toBeVisible();

			await selectedWindow.getByTestId("memo-brain-context-dock-close").click();
			await expect(selectedWindow).toHaveCount(0);

			await page.getByTestId("memo-brain-toggle-selected-panel").click({
				force: true,
			});
			await expect(selectedWindow).toBeVisible();

			const beforeDrag = await selectedWindow.boundingBox();
			if (!beforeDrag) {
				throw new Error("Selected sticky bounds unavailable before drag");
			}

			await dragSelectedWindow(page, 120, 72);

			const afterDrag = await selectedWindow.boundingBox();
			if (!afterDrag) {
				throw new Error("Selected sticky bounds unavailable after drag");
			}

			expect(
				afterDrag.x > beforeDrag.x + 48 || afterDrag.y > beforeDrag.y + 24,
			).toBe(true);

			await selectedWindow.getByTestId("memo-brain-context-dock-close").click();
			await expect(selectedWindow).toHaveCount(0);
			await page.getByTestId("memo-brain-toggle-selected-panel").click({
				force: true,
			});
			await expect(selectedWindow).toBeVisible();

			const retained = await selectedWindow.boundingBox();
			if (!retained) {
				throw new Error("Selected sticky bounds unavailable after reopen");
			}

			expect(Math.abs(retained.x - afterDrag.x)).toBeLessThanOrEqual(12);
			expect(Math.abs(retained.y - afterDrag.y)).toBeLessThanOrEqual(12);
		});

		test("connects the selected sticky with a persisted yarn color", async ({
			page,
		}) => {
			await page.setViewportSize({ width: 1280, height: 820 });
			await signUpAndSignIn(page);
			await expectBrainAtlas(page);

			await createSticky(page, { title: "Alpha", content: "Anchor memo" });
			let editor = await createSticky(page, {
				title: "Beta",
				content: "Second memo",
			});

			await editor.getByTestId("memo-palette-yarn-violet").click();
			await editor.getByTestId("memo-brain-connect-selected").click();
			await expect(
				editor.getByTestId("memo-brain-disconnect-selected"),
			).toBeVisible();

			await page.reload();
			await expectBrainAtlas(page);
			editor = await getVisibleEditor(page);
			await editor.getByRole("button", { name: /^Alpha$/ }).click();

			await expect(
				editor.getByTestId("memo-editor-connection-status"),
			).toHaveText("연결됨");
			await expect(editor.getByTestId("memo-palette-yarn-violet")).toHaveClass(
				/text-white/,
			);
		});

		test("keeps global search separate from atlas node search", async ({
			page,
		}) => {
			await page.setViewportSize({ width: 1280, height: 820 });
			await signUpAndSignIn(page);
			await expectBrainAtlas(page);

			await createSticky(page, { title: "Alpha", content: "Anchor memo" });
			await createSticky(page, { title: "Beta", content: "Second memo" });
			await selectMemoFromBrain(page, "Alpha");
			await page.getByTestId("memo-brain-search").fill("");

			const globalSearch = page.getByTestId("memo-global-search");
			await globalSearch.fill("Alpha");
			await page.waitForTimeout(450);

			const listPanel = await openBrainListPanel(page);
			await expect(
				listPanel.getByRole("button", { name: /Alpha/i }).first(),
			).toBeVisible();
			await expect(
				listPanel.getByRole("button", { name: /Beta/i }),
			).toHaveCount(0);

			await globalSearch.fill("");
			await page.waitForTimeout(450);
			await page.getByTestId("memo-brain-search").fill("Beta");

			await expect(
				listPanel.getByRole("button", { name: /Beta/i }).first(),
			).toBeVisible();
		});
	});
}
