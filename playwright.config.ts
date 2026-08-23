import { defineConfig } from "@playwright/test";

export default defineConfig({
	testDir: "./tests/e2e",
	fullyParallel: false,
	workers: 1,
	retries: 0,
	timeout: 45_000,
	expect: {
		timeout: 7_000,
	},
	use: {
		baseURL: "http://127.0.0.1:4173",
		trace: "retain-on-failure",
		screenshot: "only-on-failure",
		video: "off",
	},
	webServer: {
		command:
			"mkdir -p .tmp && rm -f .tmp/e2e-mobile.db .tmp/e2e-mobile.db-shm .tmp/e2e-mobile.db-wal && PORT=4173 SQLITE_PATH=.tmp/e2e-mobile.db bun src/server/index.ts",
		url: "http://127.0.0.1:4173/sign-in",
		reuseExistingServer: false,
		timeout: 120_000,
	},
});
