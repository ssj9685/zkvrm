import { expect, test } from "@playwright/test";

const visualThreshold = 0.0015;
const isPlaywrightRuntime = process.argv.some((arg) =>
	arg.toLowerCase().includes("playwright"),
);

if (isPlaywrightRuntime) {
	test.describe("auth scrapbook visuals", () => {
		test("captures login and register baselines", async ({ page }) => {
			await page.setViewportSize({ width: 1280, height: 820 });

			await page.goto("/sign-in");
			await expect(
				page.getByRole("heading", { name: "메모판으로 돌아오기" }),
			).toBeVisible();
			await expect(page.locator("main")).toHaveScreenshot(
				"auth-scrapbook-scene-01-sign-in.png",
				{
					maxDiffPixelRatio: visualThreshold,
				},
			);

			await page.goto("/sign-up");
			await expect(
				page.getByRole("heading", { name: "스크랩북 작업실 만들기" }),
			).toBeVisible();
			await expect(page.locator("main")).toHaveScreenshot(
				"auth-scrapbook-scene-02-sign-up.png",
				{
					maxDiffPixelRatio: visualThreshold,
				},
			);
		});
	});
}
