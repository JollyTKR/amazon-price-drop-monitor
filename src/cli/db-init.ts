import { dirname } from "node:path";
import { mkdir } from "node:fs/promises";

import { loadConfig } from "../config/loadConfig.js";
import { logger } from "../logging/logger.js";
import { openDatabase, runMigrations } from "../storage/migrations.js";

try {
  const configPath = process.argv[2] ?? "config.example.yaml";
  const config = await loadConfig(configPath);

  await mkdir(dirname(config.database.path), { recursive: true });

  const db = openDatabase(config.database.path);
  try {
    runMigrations(db);
  } finally {
    db.close();
  }

  console.log(`Initialized SQLite database at ${config.database.path}`);
} catch (error) {
  logger.error(
    {
      event: "db_init_failed",
      status: "failure",
      errorMessage: getErrorMessage(error),
    },
    "Database initialization failed",
  );
  process.exit(1);
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
