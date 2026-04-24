import { dirname } from "node:path";
import { mkdir } from "node:fs/promises";

import { loadConfig } from "../config/loadConfig.js";
import { openDatabase, runMigrations } from "../storage/migrations.js";

const configPath = process.argv[2] ?? "config.example.yaml";
const config = await loadConfig(configPath);

await mkdir(dirname(config.database.path), { recursive: true });

const db = openDatabase(config.database.path);
runMigrations(db);
db.close();

console.log(`Initialized SQLite database at ${config.database.path}`);
