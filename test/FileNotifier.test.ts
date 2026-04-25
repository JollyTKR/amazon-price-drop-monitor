import { mkdtemp, readFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { describe, expect, it } from "vitest";

import { FileNotifier } from "../src/notification/FileNotifier.js";
import type { PriceDropEvent } from "../src/monitor/PriceDropDetector.js";

const event: PriceDropEvent = {
  productId: "keyboard",
  productName: "Compact Mechanical Keyboard",
  productUrl: "https://www.amazon.com/dp/KEYBOARD",
  previousPriceCents: 7999,
  currentPriceCents: 5999,
  dropAmountCents: 2000,
  dropPercent: 25.003125390673837,
  checkedAt: "2026-04-24T12:00:00.000Z",
};

describe("FileNotifier", () => {
  it("appends a readable price drop notification to a local file", async () => {
    const tempDir = await mkdtemp(join(tmpdir(), "file-notifier-"));
    const filePath = join(tempDir, "notifications.log");
    const notifier = new FileNotifier(filePath);

    const result = await notifier.notifyPriceDrop(event);

    expect(result).toMatchObject({
      status: "sent",
    });
    const fileContents = await readFile(filePath, "utf8");
    expect(fileContents).toContain("PRICE DROP DETECTED");
    expect(fileContents).toContain("Compact Mechanical Keyboard");
    expect(fileContents).toContain("Previous price: $79.99");
    expect(fileContents).toContain("Current price: $59.99");
    expect(fileContents).toContain("Drop amount: $20.00");
  });
});
