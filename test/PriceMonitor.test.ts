import { mkdtemp, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

import Database from "better-sqlite3";
import { describe, expect, it, vi } from "vitest";

import { createLogger } from "../src/logging/logger.js";
import { PriceMonitor } from "../src/monitor/PriceMonitor.js";
import type { Notifier } from "../src/notification/Notifier.js";
import { ConsoleNotifier } from "../src/notification/ConsoleNotifier.js";
import { FixtureHtmlPriceSource } from "../src/price-source/FixtureHtmlPriceSource.js";
import type { PriceHistoryRepository } from "../src/storage/PriceHistoryRepository.js";
import { runMigrations } from "../src/storage/migrations.js";
import { SqlitePriceHistoryRepository } from "../src/storage/SqlitePriceHistoryRepository.js";
import type { AppConfig } from "../src/types/domain.js";

describe("PriceMonitor", () => {
  it("records baseline prices, then detects and records a notification after a fixture price drops", async () => {
    const tempDir = await mkdtemp(join(tmpdir(), "price-monitor-"));
    const keyboardFixture = join(tempDir, "keyboard.html");
    const usbHubFixture = join(tempDir, "usb-hub.html");
    const deskMatFixture = join(tempDir, "desk-mat.html");

    await Promise.all([
      writeFixture(keyboardFixture, "$100.00"),
      writeFixture(usbHubFixture, "$50.00"),
      writeFixture(deskMatFixture, "$25.00"),
    ]);

    const db = new Database(":memory:");
    runMigrations(db);
    const repository = new SqlitePriceHistoryRepository(db);
    const output = {
      log: vi.fn(),
      error: vi.fn(),
    };
    const monitor = new PriceMonitor({
      config: createConfig({
        keyboardFixture,
        usbHubFixture,
        deskMatFixture,
      }),
      priceSource: new FixtureHtmlPriceSource(),
      repository,
      notifier: new ConsoleNotifier(output),
      logger: createLogger({ enabled: false }),
    });

    const firstRun = await monitor.runOnce();

    expect(firstRun).toMatchObject({
      totalProducts: 3,
      succeeded: 3,
      failed: 0,
      notificationsSent: 0,
    });
    expect(repository.getPriceHistory("keyboard")).toHaveLength(1);
    expect(output.log).not.toHaveBeenCalled();

    await writeFixture(keyboardFixture, "$80.00");

    const secondRun = await monitor.runOnce();

    expect(secondRun).toMatchObject({
      totalProducts: 3,
      succeeded: 3,
      failed: 0,
      notificationsSent: 1,
    });
    expect(repository.getPriceHistory("keyboard")).toHaveLength(2);
    expect(repository.getLatestSuccessfulPriceCheck("keyboard")).toMatchObject({
      priceCents: 8000,
    });
    expect(repository.getRecentNotifications({ productId: "keyboard", limit: 10 })).toEqual([
      expect.objectContaining({
        productId: "keyboard",
        previousPriceCents: 10000,
        currentPriceCents: 8000,
        dropAmountCents: 2000,
        status: "sent",
      }),
    ]);
    expect(output.log).toHaveBeenCalledWith(expect.stringContaining("PRICE DROP DETECTED"));
    expect(output.log).toHaveBeenCalledWith(expect.stringContaining("Current price: $80.00"));

    db.close();
  });

  it("records one missing fixture as a failed check while other products continue", async () => {
    const tempDir = await mkdtemp(join(tmpdir(), "price-monitor-failure-"));
    const keyboardFixture = join(tempDir, "keyboard.html");
    const missingFixture = join(tempDir, "missing-usb-hub.html");
    const deskMatFixture = join(tempDir, "desk-mat.html");

    await Promise.all([
      writeFixture(keyboardFixture, "$100.00"),
      writeFixture(deskMatFixture, "$25.00"),
    ]);

    const db = new Database(":memory:");
    runMigrations(db);
    const repository = new SqlitePriceHistoryRepository(db);
    const logger = createTestLogger();
    const monitor = new PriceMonitor({
      config: createConfig({
        keyboardFixture,
        usbHubFixture: missingFixture,
        deskMatFixture,
      }),
      priceSource: new FixtureHtmlPriceSource(undefined, join(tempDir, "missing-state.json")),
      repository,
      notifier: new ConsoleNotifier({ log: vi.fn(), error: vi.fn() }),
      logger,
    });

    const result = await monitor.runOnce();

    expect(result).toMatchObject({
      totalProducts: 3,
      succeeded: 2,
      failed: 1,
    });
    expect(repository.getPriceHistory("keyboard")).toHaveLength(1);
    expect(repository.getPriceHistory("desk-mat")).toHaveLength(1);
    expect(repository.getPriceHistory("usb-hub")).toEqual([
      expect.objectContaining({
        productId: "usb-hub",
        status: "failure",
        priceCents: null,
        errorMessage: expect.stringContaining("Unable to read fixture"),
      }),
    ]);
    expect(logger.warn).toHaveBeenCalledWith(
      expect.objectContaining({
        event: "price_check_failed",
        productId: "usb-hub",
        productName: "USB Hub",
        source: "fixture-html",
        status: "failure",
        errorMessage: expect.stringContaining("Unable to read fixture"),
      }),
      "Price check failed",
    );

    db.close();
  });

  it("records notification failures without failing the product check", async () => {
    const tempDir = await mkdtemp(join(tmpdir(), "price-monitor-notification-"));
    const keyboardFixture = join(tempDir, "keyboard.html");
    const usbHubFixture = join(tempDir, "usb-hub.html");
    const deskMatFixture = join(tempDir, "desk-mat.html");

    await Promise.all([
      writeFixture(keyboardFixture, "$100.00"),
      writeFixture(usbHubFixture, "$50.00"),
      writeFixture(deskMatFixture, "$25.00"),
    ]);

    const db = new Database(":memory:");
    runMigrations(db);
    const repository = new SqlitePriceHistoryRepository(db);
    const notifier: Notifier = {
      notifyPriceDrop: vi.fn(async () => {
        throw new Error("console unavailable");
      }),
    };
    const monitor = new PriceMonitor({
      config: createConfig({
        keyboardFixture,
        usbHubFixture,
        deskMatFixture,
      }),
      priceSource: new FixtureHtmlPriceSource(undefined, join(tempDir, "missing-state.json")),
      repository,
      notifier,
      logger: createLogger({ enabled: false }),
    });

    await monitor.runOnce();
    await writeFixture(keyboardFixture, "$80.00");

    const result = await monitor.runOnce();

    expect(result).toMatchObject({
      totalProducts: 3,
      succeeded: 3,
      failed: 0,
      notificationsSent: 0,
      notificationsFailed: 1,
    });
    expect(repository.getRecentNotifications({ productId: "keyboard", limit: 10 })).toEqual([
      expect.objectContaining({
        productId: "keyboard",
        status: "failed",
        errorMessage: "console unavailable",
      }),
    ]);

    db.close();
  });

  it("logs database write failures without rejecting the monitor run", async () => {
    const repository: PriceHistoryRepository = {
      recordPriceCheck: vi.fn(() => {
        throw new Error("database is readonly");
      }),
      getLatestPriceCheck: vi.fn(() => null),
      getLatestSuccessfulPriceCheck: vi.fn(() => null),
      getPriceHistory: vi.fn(() => []),
      recordNotification: vi.fn(() => {
        throw new Error("should not record notification");
      }),
      getRecentNotifications: vi.fn(() => []),
    };
    const logger = createTestLogger();
    const notifier: Notifier = {
      notifyPriceDrop: vi.fn(),
    };
    const monitor = new PriceMonitor({
      config: createConfig({
        keyboardFixture: "fixtures/keyboard.html",
        usbHubFixture: "fixtures/usb-hub.html",
        deskMatFixture: "fixtures/desk-mat.html",
      }),
      priceSource: new FixtureHtmlPriceSource(undefined, "data/does-not-exist-demo-state.json"),
      repository,
      notifier,
      logger,
    });

    const result = await monitor.runOnce();

    expect(result).toMatchObject({
      totalProducts: 3,
      succeeded: 0,
      failed: 3,
      notificationsSent: 0,
      notificationsFailed: 0,
    });
    expect(logger.error).toHaveBeenCalledWith(
      expect.objectContaining({
        event: "price_check_record_failed",
        productId: "keyboard",
        productName: "Keyboard",
        source: "fixture-html",
        status: "success",
        errorMessage: "database is readonly",
      }),
      "Failed to persist price check",
    );
    expect(notifier.notifyPriceDrop).not.toHaveBeenCalled();
  });
});

async function writeFixture(path: string, price: string): Promise<void> {
  await writeFile(
    path,
    `
      <!doctype html>
      <html lang="en">
        <body>
          <span class="a-price">
            <span class="a-offscreen">${price}</span>
          </span>
        </body>
      </html>
    `,
    "utf8",
  );
}

function createConfig(paths: {
  keyboardFixture: string;
  usbHubFixture: string;
  deskMatFixture: string;
}): AppConfig {
  return {
    database: {
      path: ":memory:",
    },
    priceSource: {
      type: "fixture-html",
    },
    scheduler: {
      intervalSeconds: 300,
      runOnStartup: true,
      maxConcurrentChecks: 2,
    },
    dropDetection: {
      minPercentDrop: 10,
      minAbsoluteDropCents: 1500,
    },
    notification: {
      type: "console",
    },
    server: {
      port: 3000,
    },
    products: [
      {
        id: "keyboard",
        name: "Keyboard",
        url: "https://www.amazon.com/dp/KEYBOARD",
        fixturePath: paths.keyboardFixture,
      },
      {
        id: "usb-hub",
        name: "USB Hub",
        url: "https://www.amazon.com/dp/USBHUB",
        fixturePath: paths.usbHubFixture,
      },
      {
        id: "desk-mat",
        name: "Desk Mat",
        url: "https://www.amazon.com/dp/DESKMAT",
        fixturePath: paths.deskMatFixture,
      },
    ],
  };
}

function createTestLogger() {
  return {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  } as unknown as ReturnType<typeof createLogger>;
}
