import { Database } from "bun:sqlite";

const databasePath = process.env.SQLITE_PATH ?? "zkvrm.sqlite";

// Ensure migrations run before the database is used
await import("../../scripts/migrate");

export const db = new Database(databasePath, { create: true });
