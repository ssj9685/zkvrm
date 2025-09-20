import { Database } from "bun:sqlite";

// Ensure migrations run before the database is used
await import("../../scripts/migrate");

export const db = new Database("zkvrm.sqlite", { create: true });
