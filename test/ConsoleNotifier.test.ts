import { describe, expect, it, vi } from "vitest";

import { ConsoleNotifier, formatPriceDropNotification } from "../src/notification/ConsoleNotifier.js";
import type { PriceDropEvent } from "../src/monitor/PriceDropDetector.js";

const event: PriceDropEvent = {
  productId: "keyboard",
  productName: "Compact Mechanical Keyboard",
  productUrl: "https://www.amazon.com/dp/KEYBOARD",
  previousPriceCents: 9999,
  currentPriceCents: 7999,
  dropAmountCents: 2000,
  dropPercent: 20.002000200020003,
  checkedAt: "2026-04-24T12:00:00.000Z",
};

describe("ConsoleNotifier", () => {
  it("writes a readable price drop notification to the console", async () => {
    const output = {
      log: vi.fn(),
      error: vi.fn(),
    };
    const notifier = new ConsoleNotifier(output);

    const result = await notifier.notifyPriceDrop(event);

    expect(result).toMatchObject({
      status: "sent",
    });
    expect(result.sentAt).toEqual(expect.any(String));
    expect(output.error).not.toHaveBeenCalled();
    expect(output.log).toHaveBeenCalledWith(expect.stringContaining("PRICE DROP DETECTED"));
    expect(output.log).toHaveBeenCalledWith(expect.stringContaining("Compact Mechanical Keyboard"));
    expect(output.log).toHaveBeenCalledWith(expect.stringContaining("Previous price: $99.99"));
    expect(output.log).toHaveBeenCalledWith(expect.stringContaining("Current price: $79.99"));
    expect(output.log).toHaveBeenCalledWith(expect.stringContaining("Drop amount: $20.00"));
    expect(output.log).toHaveBeenCalledWith(expect.stringContaining("Drop percent: 20.00%"));
  });

  it("returns a failed result when console output throws", async () => {
    const output = {
      log: vi.fn(() => {
        throw new Error("stdout unavailable");
      }),
      error: vi.fn(),
    };
    const notifier = new ConsoleNotifier(output);

    const result = await notifier.notifyPriceDrop(event);

    expect(result).toMatchObject({
      status: "failed",
      errorMessage: "stdout unavailable",
    });
    expect(result.sentAt).toEqual(expect.any(String));
    expect(output.error).toHaveBeenCalledWith(
      "Failed to write console notification: stdout unavailable",
    );
  });

  it("formats the notification message with reviewer-friendly details", () => {
    expect(formatPriceDropNotification(event)).toBe(
      [
        "PRICE DROP DETECTED",
        "Product: Compact Mechanical Keyboard",
        "URL: https://www.amazon.com/dp/KEYBOARD",
        "Previous price: $99.99",
        "Current price: $79.99",
        "Drop amount: $20.00",
        "Drop percent: 20.00%",
        "Checked at: 2026-04-24T12:00:00.000Z",
      ].join("\n"),
    );
  });
});
