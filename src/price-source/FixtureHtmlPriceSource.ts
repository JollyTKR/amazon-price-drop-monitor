import { readFile } from "node:fs/promises";

import { HtmlPriceParser } from "./HtmlPriceParser.js";
import type { PriceSource } from "./PriceSource.js";
import type { PriceSourceResult, ProductConfig } from "../types/domain.js";

export class FixtureHtmlPriceSource implements PriceSource {
  constructor(private readonly parser = new HtmlPriceParser()) {}

  async getCurrentPrice(product: ProductConfig): Promise<PriceSourceResult> {
    let html: string;

    try {
      html = await readFile(product.fixturePath, "utf8");
    } catch (error) {
      return {
        ok: false,
        productId: product.id,
        reason: "fixture-read-failed",
        message: `Unable to read fixture at ${product.fixturePath}: ${getErrorMessage(error)}`,
      };
    }

    const parsedPrice = this.parser.parse(html);

    if (!parsedPrice.ok) {
      return {
        ok: false,
        productId: product.id,
        reason: parsedPrice.reason,
        message: parsedPrice.message,
      };
    }

    return {
      ok: true,
      price: {
        productId: product.id,
        priceCents: parsedPrice.priceCents,
        currency: parsedPrice.currency,
        source: "fixture-html",
        fetchedAt: new Date(),
      },
    };
  }
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
