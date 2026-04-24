export const PRICE_SOURCE_TYPES = ["fixture-html"] as const;
export type PriceSourceType = (typeof PRICE_SOURCE_TYPES)[number];

export const NOTIFICATION_TYPES = ["console"] as const;
export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

export interface DatabaseConfig {
  path: string;
}

export interface PriceSourceConfig {
  type: PriceSourceType;
}

export interface SchedulerConfig {
  intervalSeconds: number;
  runOnStartup: boolean;
  maxConcurrentChecks: number;
}

export interface DropDetectionConfig {
  minPercentDrop: number;
  minAbsoluteDropCents: number;
}

export interface NotificationConfig {
  type: NotificationType;
}

export interface ServerConfig {
  port: number;
}

export interface ProductConfig {
  id: string;
  name: string;
  url: string;
  fixturePath: string;
}

export interface CurrentPrice {
  productId: string;
  priceCents: number;
  currency: "USD";
  source: PriceSourceType;
  fetchedAt: Date;
}

export type PriceFailureReason = "price-not-found" | "malformed-price" | "fixture-read-failed";

export interface PriceSourceSuccess {
  ok: true;
  price: CurrentPrice;
}

export interface PriceSourceFailure {
  ok: false;
  productId: string;
  reason: PriceFailureReason;
  message: string;
}

export type PriceSourceResult = PriceSourceSuccess | PriceSourceFailure;

export interface AppConfig {
  database: DatabaseConfig;
  priceSource: PriceSourceConfig;
  scheduler: SchedulerConfig;
  dropDetection: DropDetectionConfig;
  notification: NotificationConfig;
  server: ServerConfig;
  products: ProductConfig[];
}
