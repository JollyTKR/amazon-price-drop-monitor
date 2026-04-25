import { mkdtemp, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { describe, expect, it } from "vitest";

import { FixtureHtmlPriceSource } from "../src/price-source/FixtureHtmlPriceSource.js";
import type { ProductConfig } from "../src/types/domain.js";

const keyboardProduct: ProductConfig = {
  id: "example-1",
  name: "Compact Mechanical Keyboard",
  url: "https://www.amazon.com/dp/EXAMPLE1",
  fixturePath: "fixtures/keyboard.html",
};

describe("FixtureHtmlPriceSource", () => {
  it("uses the product fixture path when no demo state file exists", async () => {
    const source = new FixtureHtmlPriceSource(undefined, "data/does-not-exist-demo-state.json");

    const result = await source.getCurrentPrice(keyboardProduct);

    expect(result).toMatchObject({
      ok: true,
      price: {
        productId: "example-1",
        priceCents: 7999,
        currency: "USD",
        source: "fixture-html",
      },
    });
  });

  it("uses a demo state override fixture for the configured product", async () => {
    const tempDir = await mkdtemp(join(tmpdir(), "fixture-state-"));
    const statePath = join(tempDir, "demo-fixture-state.json");
    await writeFile(
      statePath,
      JSON.stringify({
        overrides: {
          "example-1": "fixtures/demo/keyboard-drop.html",
        },
      }),
      "utf8",
    );
    const source = new FixtureHtmlPriceSource(undefined, statePath);

    const result = await source.getCurrentPrice(keyboardProduct);

    expect(result).toMatchObject({
      ok: true,
      price: {
        productId: "example-1",
        priceCents: 5999,
        currency: "USD",
        source: "fixture-html",
      },
    });
  });
});
