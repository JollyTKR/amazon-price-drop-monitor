import { describe, expect, it } from "vitest";

import { appConfigSchema } from "../src/config/config.schema.js";
import { loadConfig } from "../src/config/loadConfig.js";

const validConfig = {
  database: {
    path: "data/price-history.sqlite",
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
      id: "example-1",
      name: "Example Product 1",
      url: "https://www.amazon.com/dp/EXAMPLE1",
      fixturePath: "fixtures/products/example-1.html",
    },
    {
      id: "example-2",
      name: "Example Product 2",
      url: "https://www.amazon.com/dp/EXAMPLE2",
      fixturePath: "fixtures/products/example-2.html",
    },
    {
      id: "example-3",
      name: "Example Product 3",
      url: "https://www.amazon.com/dp/EXAMPLE3",
      fixturePath: "fixtures/products/example-3.html",
    },
  ],
};

describe("config validation", () => {
  it("loads config.example.yaml", async () => {
    await expect(loadConfig("config.example.yaml")).resolves.toMatchObject({
      priceSource: { type: "fixture-html" },
      notification: { type: "console" },
      products: expect.arrayContaining([
        expect.objectContaining({
          id: "example-1",
          fixturePath: "fixtures/keyboard.html",
        }),
      ]),
    });
  });

  it("requires at least 3 products", () => {
    const result = appConfigSchema.safeParse({
      ...validConfig,
      products: validConfig.products.slice(0, 2),
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toBe("At least 3 products must be configured");
    }
  });

  it("requires positive scheduler values", () => {
    const result = appConfigSchema.safeParse({
      ...validConfig,
      scheduler: {
        ...validConfig.scheduler,
        intervalSeconds: 0,
        maxConcurrentChecks: -1,
      },
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      const messages = result.error.issues.map((issue) => issue.message);
      expect(messages).toContain("scheduler.intervalSeconds must be positive");
      expect(messages).toContain("scheduler.maxConcurrentChecks must be positive");
    }
  });

  it("requires product ids to be unique", () => {
    const result = appConfigSchema.safeParse({
      ...validConfig,
      products: [
        validConfig.products[0],
        {
          ...validConfig.products[1],
          id: validConfig.products[0]?.id,
        },
        validConfig.products[2],
      ],
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            message: 'Product id "example-1" must be unique',
            path: ["products", 1, "id"],
          }),
        ]),
      );
    }
  });

  it("allows file notifications with a default file path", () => {
    const result = appConfigSchema.safeParse({
      ...validConfig,
      notification: {
        type: "file",
      },
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.notification).toEqual({
        type: "file",
        filePath: "data/notifications.log",
      });
    }
  });
});
