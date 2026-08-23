import { expect, type Page } from "@playwright/test";

export async function signUpAndSignIn(page: Page) {
	const username = `mobile-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
	const password = "pass1234";

	await page.goto("/sign-up");
	await page.getByRole("textbox", { name: "아이디" }).fill(username);
	await page.getByRole("textbox", { name: "비밀번호" }).fill(password);
	await page.getByRole("button", { name: "작업실 만들기" }).click();
	await expect(page).toHaveURL(/\/sign-in$/);

	await page.getByRole("textbox", { name: "아이디" }).fill(username);
	await page.getByRole("textbox", { name: "비밀번호" }).fill(password);
	await page.getByRole("button", { name: "작업실 들어가기" }).click();
	await expect(page).toHaveURL(/\/memo$/);

	return { username, password };
}

export async function createFirstMemo(page: Page) {
	const emptyCreate = page
		.locator("main")
		.getByRole("button", { name: "메모 만들기" })
		.first();

	if (await emptyCreate.isVisible()) {
		await emptyCreate.click();
		return;
	}

	await page.getByRole("button", { name: "메모 만들기" }).last().click();
}
