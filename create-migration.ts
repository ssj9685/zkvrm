import { writeFileSync } from "node:fs";
import { join } from "node:path";

function createMigrationFile(migrationName: string) {
  if (!migrationName) {
    console.error("Usage: bun run create-migration <migration_name>");
    process.exit(1);
  }

  const now = new Date();
  const timestamp = [
    now.getFullYear(),
    (now.getMonth() + 1).toString().padStart(2, "0"),
    now.getDate().toString().padStart(2, "0"),
    now.getHours().toString().padStart(2, "0"),
    now.getMinutes().toString().padStart(2, "0"),
    now.getSeconds().toString().padStart(2, "0"),
  ].join("");

  const filename = `${timestamp}_${migrationName}.sql`;
  const filePath = join(import.meta.dir, "migrations", filename);

  try {
    writeFileSync(filePath, "");
    console.log(`Created migration file: ${filePath}`);
  } catch (error) {
    console.error(`Failed to create migration file: ${error}`);
    process.exit(1);
  }
}

const migrationName = process.argv[2];
createMigrationFile(migrationName);
