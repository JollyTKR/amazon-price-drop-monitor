import { dirname } from "node:path";
import { mkdir } from "node:fs/promises";

import { loadConfig } from "../config/loadConfig.js";
import { logger } from "../logging/logger.js";
import { PriceMonitor } from "../monitor/PriceMonitor.js";
import { ConsoleNotifier } from "../notification/ConsoleNotifier.js";
import { FixtureHtmlPriceSource } from "../price-source/FixtureHtmlPriceSource.js";
import { openDatabase, runMigrations } from "../storage/migrations.js";
import { SqlitePriceHistoryRepository } from "../storage/SqlitePriceHistoryRepository.js";

const configPath = process.argv[2] ?? "config.example.yaml";
const config = await loadConfig(configPath);

await mkdir(dirname(config.database.path), { recursive: true });

const db = openDatabase(config.database.path);
runMigrations(db);

try {
  const monitor = new PriceMonitor({
    config,
    priceSource: new FixtureHtmlPriceSource(),
    repository: new SqlitePriceHistoryRepository(db),
    notifier: new ConsoleNotifier(),
    logger,
  });

  await monitor.runOnce();
} finally {
  db.close();
}
