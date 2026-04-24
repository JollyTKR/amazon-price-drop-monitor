export type PriceCheckStatus = "success" | "failure";
export type NotificationStatus = "sent" | "failed";

export interface RecordPriceCheckInput {
  productId: string;
  productName: string;
  productUrl: string;
  checkedAt: Date | string;
  priceCents: number | null;
  currency: string | null;
  status: PriceCheckStatus;
  errorMessage?: string | null;
  source: string;
}

export interface PriceCheckRecord {
  id: number;
  productId: string;
  productName: string;
  productUrl: string;
  checkedAt: string;
  priceCents: number | null;
  currency: string | null;
  status: PriceCheckStatus;
  errorMessage: string | null;
  source: string;
}

export interface RecordNotificationInput {
  productId: string;
  productName: string;
  previousPriceCents: number;
  currentPriceCents: number;
  dropAmountCents: number;
  dropPercent: number;
  sentAt: Date | string;
  status: NotificationStatus;
  errorMessage?: string | null;
}

export interface NotificationRecord {
  id: number;
  productId: string;
  productName: string;
  previousPriceCents: number;
  currentPriceCents: number;
  dropAmountCents: number;
  dropPercent: number;
  sentAt: string;
  status: NotificationStatus;
  errorMessage: string | null;
}

export interface GetRecentNotificationsOptions {
  productId?: string;
  limit?: number;
}

export interface PriceHistoryRepository {
  recordPriceCheck(input: RecordPriceCheckInput): PriceCheckRecord;
  getLatestSuccessfulPriceCheck(productId: string): PriceCheckRecord | null;
  getPriceHistory(productId: string): PriceCheckRecord[];
  recordNotification(input: RecordNotificationInput): NotificationRecord;
  getRecentNotifications(options?: GetRecentNotificationsOptions): NotificationRecord[];
}
