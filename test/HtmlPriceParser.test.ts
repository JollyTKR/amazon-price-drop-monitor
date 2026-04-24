import { readFile } from "node:fs/promises";

import { describe, expect, it } from "vitest";

import { HtmlPriceParser } from "../src/price-source/HtmlPriceParser.js";

const parser = new HtmlPriceParser();

describe("HtmlPriceParser", () => {
  it("parses a normal price", async () => {
    const html = await readFile("fixtures/keyboard.html", "utf8");

    const result = parser.parse(html);

    expect(result).toMatchObject({
      ok: true,
      priceCents: 7999,
      currency: "USD",
    });
  });

  it("parses a price with comma separators", async () => {
    const html = await readFile("fixtures/usb-hub.html", "utf8");

    const result = parser.parse(html);

    expect(result).toMatchObject({
      ok: true,
      priceCents: 129999,
      currency: "USD",
    });
  });

  it("handles missing price", async () => {
    const html = await readFile("fixtures/missing-price.html", "utf8");

    const result = parser.parse(html);

    expect(result).toMatchObject({
      ok: false,
      reason: "price-not-found",
    });
  });

  it("handles malformed price", () => {
    const result = parser.parse(`
      <html>
        <body>
          <span class="a-price">
            <span class="a-offscreen">See price in cart</span>
          </span>
        </body>
      </html>
    `);

    expect(result).toMatchObject({
      ok: false,
      reason: "malformed-price",
    });
  });
});
