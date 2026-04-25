import { appendFile, mkdir } from "node:fs/promises";
import { dirname } from "node:path";

import type { PriceDropEvent } from "../monitor/PriceDropDetector.js";
import { formatPriceDropNotification } from "./ConsoleNotifier.js";
import type { NotificationResult, Notifier } from "./Notifier.js";

export class FileNotifier implements Notifier {
  constructor(private readonly filePath: string) {}

  async notifyPriceDrop(event: PriceDropEvent): Promise<NotificationResult> {
    const sentAt = new Date().toISOString();

    try {
      await mkdir(dirname(this.filePath), { recursive: true });
      await appendFile(
        this.filePath,
        `[${sentAt}]\n${formatPriceDropNotification(event)}\n\n`,
        "utf8",
      );

      return {
        status: "sent",
        sentAt,
      };
    } catch (error) {
      return {
        status: "failed",
        sentAt,
        errorMessage: getErrorMessage(error),
      };
    }
  }
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
