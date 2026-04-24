import Database from "better-sqlite3";
import { describe, expect, it } from "vitest";

import { runMigrations } from "../src/storage/migrations.js";
import { SqlitePriceHistoryRepository } from "../src/storage/SqlitePriceHistoryRepository.js";

function createRepository(): SqlitePriceHistoryRepository {
  const db = new Database(":memory:");
  runMigrations(db);
  return new SqlitePriceHistoryRepository(db);
}

describe("SqlitePriceHistoryRepository", () => {
  it("records successful price checks and reads the latest success", () => {
    const repository = createRepository();

    repository.recordPriceCheck({
      productId: "keyboard",
      productName: "Keyboard",
      productUrl: "https://www.amazon.com/dp/KEYBOARD",
      checkedAt: "2026-04-24T10:00:00.000Z",
      priceCents: 8999,
      currency: "USD",
      status: "success",
      source: "fixture-html",
    });
    repository.recordPriceCheck({
      productId: "keyboard",
      productName: "Keyboard",
      productUrl: "https://www.amazon.com/dp/KEYBOARD",
      checkedAt: "2026-04-24T11:00:00.000Z",
      priceCents: 7999,
      currency: "USD",
      status: "success",
      source: "fixture-html",
    });

    expect(repository.getLatestSuccessfulPriceCheck("keyboard")).toMatchObject({
      productId: "keyboard",
      checkedAt: "2026-04-24T11:00:00.000Z",
      priceCents: 7999,
      status: "success",
    });
  });

  it("persists failed checks without replacing the latest successful price", () => {
    const repository = createRepository();

    repository.recordPriceCheck({
      productId: "usb-hub",
      productName: "USB Hub",
      productUrl: "https://www.amazon.com/dp/USBHUB",
      checkedAt: "2026-04-24T10:00:00.000Z",
      priceCents: 2599,
      currency: "USD",
      status: "success",
      source: "fixture-html",
    });
    repository.recordPriceCheck({
      productId: "usb-hub",
      productName: "USB Hub",
      productUrl: "https://www.amazon.com/dp/USBHUB",
      checkedAt: "2026-04-24T11:00:00.000Z",
      priceCents: null,
      currency: null,
      status: "failure",
      errorMessage: "No price found",
      source: "fixture-html",
    });

    expect(repository.getPriceHistory("usb-hub")).toHaveLength(2);
    expect(repository.getPriceHistory("usb-hub")[1]).toMatchObject({
      status: "failure",
      priceCents: null,
      errorMessage: "No price found",
    });
    expect(repository.getLatestSuccessfulPriceCheck("usb-hub")).toMatchObject({
      priceCents: 2599,
      checkedAt: "2026-04-24T10:00:00.000Z",
    });
  });

  it("records notifications and returns recent notifications newest first", () => {
    const repository = createRepository();

    repository.recordNotification({
      productId: "desk-mat",
      productName: "Desk Mat",
      previousPriceCents: 2999,
      currentPriceCents: 2499,
      dropAmountCents: 500,
      dropPercent: 16.67,
      sentAt: "2026-04-24T10:00:00.000Z",
      status: "sent",
    });
    repository.recordNotification({
      productId: "desk-mat",
      productName: "Desk Mat",
      previousPriceCents: 2499,
      currentPriceCents: 1999,
      dropAmountCents: 500,
      dropPercent: 20,
      sentAt: "2026-04-24T11:00:00.000Z",
      status: "failed",
      errorMessage: "Console unavailable",
    });

    expect(repository.getRecentNotifications({ productId: "desk-mat", limit: 1 })).toEqual([
      expect.objectContaining({
        productId: "desk-mat",
        currentPriceCents: 1999,
        status: "failed",
        errorMessage: "Console unavailable",
      }),
    ]);
  });
});
