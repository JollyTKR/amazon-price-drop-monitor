import type { PriceDropEvent } from "../monitor/PriceDropDetector.js";
import type { NotificationResult, Notifier } from "./Notifier.js";

export type ConsoleOutput = Pick<Console, "log" | "error">;

export class ConsoleNotifier implements Notifier {
  constructor(private readonly output: ConsoleOutput = console) {}

  async notifyPriceDrop(event: PriceDropEvent): Promise<NotificationResult> {
    const sentAt = new Date().toISOString();

    try {
      this.output.log(formatPriceDropNotification(event));
      return {
        status: "sent",
        sentAt,
      };
    } catch (error) {
      const errorMessage = getErrorMessage(error);
      this.output.error(`Failed to write console notification: ${errorMessage}`);

      return {
        status: "failed",
        sentAt,
        errorMessage,
      };
    }
  }
}

export function formatPriceDropNotification(event: PriceDropEvent): string {
  return [
    "PRICE DROP DETECTED",
    `Product: ${event.productName}`,
    `URL: ${event.productUrl}`,
    `Previous price: ${formatDollars(event.previousPriceCents)}`,
    `Current price: ${formatDollars(event.currentPriceCents)}`,
    `Drop amount: ${formatDollars(event.dropAmountCents)}`,
    `Drop percent: ${formatPercent(event.dropPercent)}`,
    `Checked at: ${event.checkedAt}`,
  ].join("\n");
}

function formatDollars(cents: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(cents / 100);
}

function formatPercent(percent: number): string {
  return `${percent.toFixed(2)}%`;
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
