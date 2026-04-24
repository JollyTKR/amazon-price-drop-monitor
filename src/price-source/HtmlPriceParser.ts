import * as cheerio from "cheerio";

import type { PriceSourceFailure } from "../types/domain.js";

export interface ParsedHtmlPrice {
  ok: true;
  priceCents: number;
  currency: "USD";
  rawPriceText: string;
}

export type HtmlPriceParseResult = ParsedHtmlPrice | Omit<PriceSourceFailure, "productId">;

const PRICE_SELECTORS = [".a-price .a-offscreen", "#priceblock_ourprice", "#priceblock_dealprice"];

export class HtmlPriceParser {
  parse(html: string): HtmlPriceParseResult {
    const $ = cheerio.load(html);
    const candidateTexts = PRICE_SELECTORS.flatMap((selector) =>
      $(selector)
        .toArray()
        .map((element) => $(element).text().trim())
        .filter((text) => text.length > 0),
    );

    if (candidateTexts.length === 0) {
      return {
        ok: false,
        reason: "price-not-found",
        message: `No price found using selectors: ${PRICE_SELECTORS.join(", ")}`,
      };
    }

    for (const rawPriceText of candidateTexts) {
      const priceCents = parseUsdCents(rawPriceText);

      if (priceCents !== null) {
        return {
          ok: true,
          priceCents,
          currency: "USD",
          rawPriceText,
        };
      }
    }

    return {
      ok: false,
      reason: "malformed-price",
      message: `Found price text but could not parse it as USD: ${candidateTexts.join(", ")}`,
    };
  }
}

function parseUsdCents(rawPriceText: string): number | null {
  const normalized = rawPriceText.replace(/,/g, "").trim();
  const match = normalized.match(/^\$?\s*(\d+)(?:\.(\d{2}))?$/);

  if (!match) {
    return null;
  }

  const dollars = Number.parseInt(match[1] ?? "", 10);
  const cents = Number.parseInt(match[2] ?? "00", 10);

  if (!Number.isSafeInteger(dollars) || !Number.isSafeInteger(cents)) {
    return null;
  }

  return dollars * 100 + cents;
}
