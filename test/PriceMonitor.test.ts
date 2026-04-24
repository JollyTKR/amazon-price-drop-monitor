import { mkdtemp, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

import Database from "better-sqlite3";
import { describe, expect, it, vi } from "vitest";

import { createLogger } from "../src/logging/logger.js";
import { PriceMonitor } from "../src/monitor/PriceMonitor.js";
import { ConsoleNotifier } from "../src/notification/ConsoleNotifier.js";
import { FixtureHtmlPriceSource } from "../src/price-source/FixtureHtmlPriceSource.js";
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
