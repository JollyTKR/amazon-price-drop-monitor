import Database from "better-sqlite3";
import { describe, expect, it } from "vitest";

import { createLogger } from "../src/logging/logger.js";
import { createWebServer } from "../src/web/server.js";
import { runMigrations } from "../src/storage/migrations.js";
import { SqlitePriceHistoryRepository } from "../src/storage/SqlitePriceHistoryRepository.js";
import type { AppConfig } from "../src/types/domain.js";

describe("web server", () => {
  it("renders the dashboard with configured products and latest status", async () => {
    const { server, db } = createTestServer();

    const response = await server.inject({
      method: "GET",
      url: "/",
    });

    expect(response.statusCode).toBe(200);
    expect(response.headers["content-type"]).toContain("text/html");
    expect(response.body).toContain("Price Drop Monitor");
    expect(response.body).toContain("Keyboard");
    expect(response.body).toContain("$79.99");
    expect(response.body).toContain("success");
    expect(response.body).toContain("/products/keyboard/history");

    await server.close();
    db.close();
  });

  it("renders product history as an HTML table", async () => {
    const { server, db } = createTestServer();

    const response = await server.inject({
      method: "GET",
      url: "/products/keyboard/history",
    });

    expect(response.statusCode).toBe(200);
    expect(response.body).toContain("<table>");
    expect(response.body).toContain("Price History");
    expect(response.body).toContain("$89.99");
    expect(response.body).toContain("$79.99");

    await server.close();
    db.close();
  });

  it("returns JSON product history", async () => {
    const { server, db } = createTestServer();

    const response = await server.inject({
      method: "GET",
      url: "/api/products/keyboard/history",
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      product: {
        id: "keyboard",
        name: "Keyboard",
      },
      history: [
        {
          productId: "keyboard",
          priceCents: 8999,
          status: "success",
        },
        {
          productId: "keyboard",
          priceCents: 7999,
          status: "success",
        },
      ],
    });

    await server.close();
    db.close();
  });
});

function createTestServer() {
  const db = new Database(":memory:");
  runMigrations(db);
  const repository = new SqlitePriceHistoryRepository(db);

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

  const server = createWebServer({
    config: createConfig(),
    repository,
    logger: createLogger({ enabled: false }),
  });

  return { server, db };
}

function createConfig(): AppConfig {
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
      minPercentDrop: 5,
      minAbsoluteDropCents: 100,
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
        fixturePath: "fixtures/keyboard.html",
      },
      {
        id: "usb-hub",
        name: "USB Hub",
        url: "https://www.amazon.com/dp/USBHUB",
        fixturePath: "fixtures/usb-hub.html",
      },
      {
        id: "desk-mat",
        name: "Desk Mat",
        url: "https://www.amazon.com/dp/DESKMAT",
        fixturePath: "fixtures/desk-mat.html",
      },
    ],
  };
}
