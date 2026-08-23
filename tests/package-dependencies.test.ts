import { describe, expect, test } from "bun:test";

describe("package dependencies", () => {
	test("does not depend on capnweb", async () => {
		const packageJson = await Bun.file("package.json").json();
		const lockfile = await Bun.file("bun.lock").text();
		const sourceFiles =
			await Bun.$`rg -l "capnweb|newHttpBatchRpc|RpcTarget" src package.json bun.lock README.md`
				.quiet()
				.nothrow()
				.text();

		expect(packageJson.dependencies?.capnweb).toBeUndefined();
		expect(packageJson.devDependencies?.capnweb).toBeUndefined();
		expect(lockfile).not.toContain('"capnweb"');
		expect(sourceFiles.trim()).toBe("");
	});
});
