import { readFile } from "node:fs/promises";

import { HtmlPriceParser } from "./HtmlPriceParser.js";
import type { PriceSource } from "./PriceSource.js";
import type { PriceSourceResult, ProductConfig } from "../types/domain.js";

interface FixtureState {
  overrides?: Record<string, string>;
}

export class FixtureHtmlPriceSource implements PriceSource {
  constructor(
    private readonly parser = new HtmlPriceParser(),
    private readonly statePath = "data/demo-fixture-state.json",
  ) {}

  async getCurrentPrice(product: ProductConfig): Promise<PriceSourceResult> {
    const fixturePathResult = await this.getFixturePath(product);

    if (!fixturePathResult.ok) {
      return {
        ok: false,
        productId: product.id,
        reason: "fixture-state-invalid",
        message: fixturePathResult.message,
      };
    }

    let html: string;

    try {
      html = await readFile(fixturePathResult.fixturePath, "utf8");
    } catch (error) {
      return {
        ok: false,
        productId: product.id,
        reason: "fixture-read-failed",
        message: `Unable to read fixture at ${fixturePathResult.fixturePath}: ${getErrorMessage(error)}`,
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

  private async getFixturePath(
    product: ProductConfig,
  ): Promise<{ ok: true; fixturePath: string } | { ok: false; message: string }> {
    let stateContents: string;

    try {
      stateContents = await readFile(this.statePath, "utf8");
    } catch (error) {
      if (isMissingFileError(error)) {
        return {
          ok: true,
          fixturePath: product.fixturePath,
        };
      }

      return {
        ok: false,
        message: `Unable to read fixture state at ${this.statePath}: ${getErrorMessage(error)}`,
      };
    }

    let state: FixtureState;

    try {
      state = JSON.parse(stateContents) as FixtureState;
    } catch (error) {
      return {
        ok: false,
        message: `Invalid fixture state JSON at ${this.statePath}: ${getErrorMessage(error)}`,
      };
    }

    return {
      ok: true,
      fixturePath: state.overrides?.[product.id] ?? product.fixturePath,
    };
  }
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function isMissingFileError(error: unknown): boolean {
  return error instanceof Error && "code" in error && error.code === "ENOENT";
}
