import { dirname } from "node:path";
import { mkdir } from "node:fs/promises";

import { loadConfig } from "../config/loadConfig.js";
import { logger } from "../logging/logger.js";
import { PriceMonitor } from "../monitor/PriceMonitor.js";
import { createNotifier } from "../notification/createNotifier.js";
import { FixtureHtmlPriceSource } from "../price-source/FixtureHtmlPriceSource.js";
import { openDatabase, runMigrations } from "../storage/migrations.js";
import { SqlitePriceHistoryRepository } from "../storage/SqlitePriceHistoryRepository.js";

try {
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
      notifier: createNotifier(config.notification),
      logger,
    });

    await monitor.runOnce();
  } finally {
    db.close();
  }
} catch (error) {
  logger.error(
    {
      event: "check_once_failed",
      status: "failure",
      errorMessage: getErrorMessage(error),
    },
    "One-time monitor check failed",
  );
  process.exit(1);
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
