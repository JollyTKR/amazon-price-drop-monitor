import type { PriceDropEvent } from "../monitor/PriceDropDetector.js";

export type NotificationStatus = "sent" | "failed";

export interface NotificationResult {
  status: NotificationStatus;
  sentAt: string;
  errorMessage?: string;
}

export interface Notifier {
  notifyPriceDrop(event: PriceDropEvent): Promise<NotificationResult>;
}
