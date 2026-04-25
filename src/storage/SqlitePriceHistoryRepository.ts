import type {
  GetRecentNotificationsOptions,
  NotificationRecord,
  NotificationStatus,
  PriceCheckRecord,
  PriceCheckStatus,
  PriceHistoryRepository,
  RecordNotificationInput,
  RecordPriceCheckInput,
} from "./PriceHistoryRepository.js";
import type { SqliteDatabase } from "./migrations.js";

interface PriceCheckRow {
  id: number;
  product_id: string;
  product_name: string;
  product_url: string;
  checked_at: string;
  price_cents: number | null;
  currency: string | null;
  status: PriceCheckStatus;
  error_message: string | null;
  source: string;
}

interface NotificationRow {
  id: number;
  product_id: string;
  product_name: string;
  previous_price_cents: number;
  current_price_cents: number;
  drop_amount_cents: number;
  drop_percent: number;
  sent_at: string;
  status: NotificationStatus;
  error_message: string | null;
}

export class SqlitePriceHistoryRepository implements PriceHistoryRepository {
  constructor(private readonly db: SqliteDatabase) {}

  recordPriceCheck(input: RecordPriceCheckInput): PriceCheckRecord {
    const checkedAt = toIsoString(input.checkedAt);
    const result = this.db
      .prepare(`
        INSERT INTO price_checks (
          product_id,
          product_name,
          product_url,
          checked_at,
          price_cents,
          currency,
          status,
          error_message,
          source
        )
        VALUES (
          @productId,
          @productName,
          @productUrl,
          @checkedAt,
          @priceCents,
          @currency,
          @status,
          @errorMessage,
          @source
        )
      `)
      .run({
        productId: input.productId,
        productName: input.productName,
        productUrl: input.productUrl,
        checkedAt,
        priceCents: input.priceCents,
        currency: input.currency,
        status: input.status,
        errorMessage: input.errorMessage ?? null,
        source: input.source,
      });

    return {
      id: Number(result.lastInsertRowid),
      productId: input.productId,
      productName: input.productName,
      productUrl: input.productUrl,
      checkedAt,
      priceCents: input.priceCents,
      currency: input.currency,
      status: input.status,
      errorMessage: input.errorMessage ?? null,
      source: input.source,
    };
  }

  getLatestPriceCheck(productId: string): PriceCheckRecord | null {
    const row = this.db
      .prepare<[string]>(`
        SELECT *
        FROM price_checks
        WHERE product_id = ?
        ORDER BY checked_at DESC, id DESC
        LIMIT 1
      `)
      .get(productId) as PriceCheckRow | undefined;

    return row ? mapPriceCheckRow(row) : null;
  }

  getLatestSuccessfulPriceCheck(productId: string): PriceCheckRecord | null {
    const row = this.db
      .prepare<[string]>(`
        SELECT *
        FROM price_checks
        WHERE product_id = ?
          AND status = 'success'
          AND price_cents IS NOT NULL
        ORDER BY checked_at DESC, id DESC
        LIMIT 1
      `)
      .get(productId) as PriceCheckRow | undefined;

    return row ? mapPriceCheckRow(row) : null;
  }

  getPriceHistory(productId: string): PriceCheckRecord[] {
    const rows = this.db
      .prepare<[string]>(`
        SELECT *
        FROM price_checks
        WHERE product_id = ?
        ORDER BY checked_at ASC, id ASC
      `)
      .all(productId) as PriceCheckRow[];

    return rows.map(mapPriceCheckRow);
  }

  recordNotification(input: RecordNotificationInput): NotificationRecord {
    const sentAt = toIsoString(input.sentAt);
    const result = this.db
      .prepare(`
        INSERT INTO notifications (
          product_id,
          product_name,
          previous_price_cents,
          current_price_cents,
          drop_amount_cents,
          drop_percent,
          sent_at,
          status,
          error_message
        )
        VALUES (
          @productId,
          @productName,
          @previousPriceCents,
          @currentPriceCents,
          @dropAmountCents,
          @dropPercent,
          @sentAt,
          @status,
          @errorMessage
        )
      `)
      .run({
        productId: input.productId,
        productName: input.productName,
        previousPriceCents: input.previousPriceCents,
        currentPriceCents: input.currentPriceCents,
        dropAmountCents: input.dropAmountCents,
        dropPercent: input.dropPercent,
        sentAt,
        status: input.status,
        errorMessage: input.errorMessage ?? null,
      });

    return {
      id: Number(result.lastInsertRowid),
      productId: input.productId,
      productName: input.productName,
      previousPriceCents: input.previousPriceCents,
      currentPriceCents: input.currentPriceCents,
      dropAmountCents: input.dropAmountCents,
      dropPercent: input.dropPercent,
      sentAt,
      status: input.status,
      errorMessage: input.errorMessage ?? null,
    };
  }

  getRecentNotifications(options: GetRecentNotificationsOptions = {}): NotificationRecord[] {
    const limit = options.limit ?? 20;

    if (!Number.isInteger(limit) || limit <= 0) {
      throw new Error("getRecentNotifications limit must be a positive integer");
    }

    const rows =
      options.productId === undefined
        ? (this.db
            .prepare<[number]>(`
              SELECT *
              FROM notifications
              ORDER BY sent_at DESC, id DESC
              LIMIT ?
            `)
            .all(limit) as NotificationRow[])
        : (this.db
            .prepare<[string, number]>(`
              SELECT *
              FROM notifications
              WHERE product_id = ?
              ORDER BY sent_at DESC, id DESC
              LIMIT ?
            `)
            .all(options.productId, limit) as NotificationRow[]);

    return rows.map(mapNotificationRow);
  }
}

function mapPriceCheckRow(row: PriceCheckRow): PriceCheckRecord {
  return {
    id: row.id,
    productId: row.product_id,
    productName: row.product_name,
    productUrl: row.product_url,
    checkedAt: row.checked_at,
    priceCents: row.price_cents,
    currency: row.currency,
    status: row.status,
    errorMessage: row.error_message,
    source: row.source,
  };
}

function mapNotificationRow(row: NotificationRow): NotificationRecord {
  return {
    id: row.id,
    productId: row.product_id,
    productName: row.product_name,
    previousPriceCents: row.previous_price_cents,
    currentPriceCents: row.current_price_cents,
    dropAmountCents: row.drop_amount_cents,
    dropPercent: row.drop_percent,
    sentAt: row.sent_at,
    status: row.status,
    errorMessage: row.error_message,
  };
}

function toIsoString(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : value;
}
