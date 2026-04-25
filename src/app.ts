import { mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import { pathToFileURL } from "node:url";

import { loadConfig } from "./config/loadConfig.js";
import { logger as defaultLogger, type AppLogger } from "./logging/logger.js";
import { PriceMonitor } from "./monitor/PriceMonitor.js";
import { Scheduler } from "./monitor/Scheduler.js";
import { createNotifier } from "./notification/createNotifier.js";
import { FixtureHtmlPriceSource } from "./price-source/FixtureHtmlPriceSource.js";
import { openDatabase, runMigrations, type SqliteDatabase } from "./storage/migrations.js";
import { SqlitePriceHistoryRepository } from "./storage/SqlitePriceHistoryRepository.js";
import type { AppConfig } from "./types/domain.js";
import { createWebServer } from "./web/server.js";
import type { FastifyInstance } from "fastify";

export interface AppRuntime {
  config: AppConfig;
  db: SqliteDatabase;
  monitor: PriceMonitor;
  scheduler: Scheduler;
  server: FastifyInstance;
  shutdown(): Promise<void>;
}

export async function createApp(
  configPath = "config.example.yaml",
  logger: AppLogger = defaultLogger,
): Promise<AppRuntime> {
  const config = await loadConfig(configPath);

  await mkdir(dirname(config.database.path), { recursive: true });

  const db = openDatabase(config.database.path);
  runMigrations(db);

  const repository = new SqlitePriceHistoryRepository(db);
  const priceSource = new FixtureHtmlPriceSource();
  const notifier = createNotifier(config.notification);
  const monitor = new PriceMonitor({
    config,
    priceSource,
    repository,
    notifier,
    logger,
  });
  const scheduler = new Scheduler({
    monitor,
    intervalSeconds: config.scheduler.intervalSeconds,
    runOnStartup: config.scheduler.runOnStartup,
    logger,
  });
  const server = createWebServer({
    config,
    repository,
    logger,
  });

  return {
    config,
    db,
    monitor,
    scheduler,
    server,
    async shutdown() {
      await scheduler.stop();
      await server.close();
      db.close();
    },
  };
}

export async function startApp(
  configPath = "config.example.yaml",
  logger: AppLogger = defaultLogger,
): Promise<AppRuntime> {
  const runtime = await createApp(configPath, logger);
  const address = await runtime.server.listen({
    port: runtime.config.server.port,
    host: "127.0.0.1",
  });
  logger.info(
    {
      event: "web_server_started",
      address,
      port: runtime.config.server.port,
    },
    "Web server started",
  );
  runtime.scheduler.start();
  return runtime;
}

export function installGracefulShutdown(runtime: AppRuntime, logger: AppLogger = defaultLogger): void {
  let shuttingDown = false;

  const shutdown = (signal: NodeJS.Signals) => {
    if (shuttingDown) {
      return;
    }

    shuttingDown = true;
    logger.info(
      {
        event: "app_shutdown_started",
        signal,
      },
      "Application shutdown started",
    );

    runtime
      .shutdown()
      .then(() => {
        logger.info(
          {
            event: "app_shutdown_completed",
            signal,
          },
          "Application shutdown completed",
        );
        process.exit(0);
      })
      .catch((error: unknown) => {
        logger.error(
          {
            event: "app_shutdown_failed",
            signal,
            error_message: getErrorMessage(error),
          },
          "Application shutdown failed",
        );
        process.exit(1);
      });
  };

  process.once("SIGINT", shutdown);
  process.once("SIGTERM", shutdown);
}

if (isMainModule()) {
  const configPath = process.argv[2] ?? "config.example.yaml";
  try {
    const runtime = await startApp(configPath);
    installGracefulShutdown(runtime);
  } catch (error) {
    defaultLogger.error(
      {
        event: "app_start_failed",
        configPath,
        status: "failure",
        errorMessage: getErrorMessage(error),
      },
      "Application failed to start",
    );
    process.exit(1);
  }
}

function isMainModule(): boolean {
  const entrypoint = process.argv[1];
  return entrypoint !== undefined && import.meta.url === pathToFileURL(entrypoint).href;
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
