import { uploadDatabaseSnapshotNow } from "@server/snapshot-scheduler";

try {
	await uploadDatabaseSnapshotNow();
	console.info("[db-snapshot] Manual snapshot completed.");
} catch (error) {
	console.error("[db-snapshot] Manual snapshot failed.", error);
	process.exit(1);
}
