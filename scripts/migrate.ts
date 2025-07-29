import { Database } from "bun:sqlite";
import { readdir } from "node:fs/promises";
import { join } from "node:path";

const db = new Database("zkvrm.sqlite");

db.run(`
  CREATE TABLE IF NOT EXISTS schema_migrations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE NOT NULL,
    created_at INTEGER DEFAULT (strftime('%s', 'now'))
  );
`);

async function runMigrations() {
  const migrationsDir = join(import.meta.dir, "migrations");
  const files = await readdir(migrationsDir);

  const migrationFiles = files
    .filter((file) => file.endsWith(".sql"))
    .sort();

  for (const file of migrationFiles) {
    const migrationName = file;
    const hasRun = db.query("SELECT id FROM schema_migrations WHERE name = ?").get(migrationName);

    if (!hasRun) {
      console.log(`Running migration: ${migrationName}`);
      const sql = await Bun.file(join(migrationsDir, file)).text();
      db.run(sql);
      db.run("INSERT INTO schema_migrations (name) VALUES (?)", [migrationName]);
      console.log(`Migration ${migrationName} completed.`);
    } else {
      console.log(`Migration ${migrationName} already applied.`);
    }
  }
  console.log("All migrations checked.");
}

runMigrations().catch(console.error);
