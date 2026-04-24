import { describe, expect, it } from "vitest";

import { detectPriceDrop, type DetectPriceDropInput } from "../src/monitor/PriceDropDetector.js";

const baseInput: DetectPriceDropInput = {
  productId: "keyboard",
  productName: "Keyboard",
  productUrl: "https://www.amazon.com/dp/KEYBOARD",
  previousPriceCents: 10000,
  currentPriceCents: 9000,
  minPercentDrop: 5,
  minAbsoluteDropCents: 2000,
  checkedAt: "2026-04-24T12:00:00.000Z",
};

describe("detectPriceDrop", () => {
  it("detects a percentage-based drop", () => {
    const result = detectPriceDrop({
      ...baseInput,
      previousPriceCents: 10000,
      currentPriceCents: 9400,
      minPercentDrop: 5,
      minAbsoluteDropCents: 2000,
    });

    expect(result).toMatchObject({
      productId: "keyboard",
      previousPriceCents: 10000,
      currentPriceCents: 9400,
      dropAmountCents: 600,
      dropPercent: 6,
      checkedAt: "2026-04-24T12:00:00.000Z",
    });
  });

  it("detects an absolute-value drop", () => {
    const result = detectPriceDrop({
      ...baseInput,
      previousPriceCents: 100000,
      currentPriceCents: 97000,
      minPercentDrop: 5,
      minAbsoluteDropCents: 2500,
    });

    expect(result).toMatchObject({
      previousPriceCents: 100000,
      currentPriceCents: 97000,
      dropAmountCents: 3000,
      dropPercent: 3,
    });
  });

  it("ignores price increase", () => {
    expect(
      detectPriceDrop({
        ...baseInput,
        previousPriceCents: 10000,
        currentPriceCents: 11000,
      }),
    ).toBeNull();
  });

  it("ignores unchanged price", () => {
    expect(
      detectPriceDrop({
        ...baseInput,
        previousPriceCents: 10000,
        currentPriceCents: 10000,
      }),
    ).toBeNull();
  });

  it("ignores tiny drop below both thresholds", () => {
    expect(
      detectPriceDrop({
        ...baseInput,
        previousPriceCents: 10000,
        currentPriceCents: 9900,
        minPercentDrop: 5,
        minAbsoluteDropCents: 500,
      }),
    ).toBeNull();
  });

  it("handles zero or invalid previous price defensively", () => {
    expect(
      detectPriceDrop({
        ...baseInput,
        previousPriceCents: 0,
        currentPriceCents: 1000,
      }),
    ).toBeNull();

    expect(
      detectPriceDrop({
        ...baseInput,
        previousPriceCents: Number.NaN,
        currentPriceCents: 1000,
      }),
    ).toBeNull();

    expect(
      detectPriceDrop({
        ...baseInput,
        previousPriceCents: 1000,
        currentPriceCents: Number.POSITIVE_INFINITY,
      }),
    ).toBeNull();
  });
});
