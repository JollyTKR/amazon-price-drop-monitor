import pLimit from "p-limit";
import type { Logger } from "pino";

import { detectPriceDrop } from "./PriceDropDetector.js";
import type { NotificationResult, Notifier } from "../notification/Notifier.js";
import type { PriceSource } from "../price-source/PriceSource.js";
import type {
  PriceHistoryRepository,
  RecordNotificationInput,
  RecordPriceCheckInput,
} from "../storage/PriceHistoryRepository.js";
import type { AppConfig, ProductConfig } from "../types/domain.js";

export interface PriceMonitorDependencies {
  config: AppConfig;
  priceSource: PriceSource;
  repository: PriceHistoryRepository;
  notifier: Notifier;
  logger: Logger;
}

export interface ProductCheckResult {
  productId: string;
  status: "success" | "failure";
  notificationStatus?: "sent" | "failed";
  errorMessage?: string;
}

export interface MonitorRunResult {
  startedAt: string;
  completedAt: string;
  totalProducts: number;
  succeeded: number;
  failed: number;
  notificationsSent: number;
  notificationsFailed: number;
  productResults: ProductCheckResult[];
}

export class PriceMonitor {
  constructor(private readonly dependencies: PriceMonitorDependencies) {}

  async runOnce(): Promise<MonitorRunResult> {
    const { config, logger } = this.dependencies;
    const startedAt = new Date().toISOString();

    logger.info(
      {
        event: "monitor_run_started",
        product_count: config.products.length,
        max_concurrent_checks: config.scheduler.maxConcurrentChecks,
        started_at: startedAt,
      },
      "Monitor run started",
    );

    const limit = pLimit(config.scheduler.maxConcurrentChecks);
    const checks = config.products.map((product) => limit(() => this.checkProduct(product)));
    const settledResults = await Promise.allSettled(checks);
    const productResults = settledResults.map((result, index): ProductCheckResult => {
      if (result.status === "fulfilled") {
        return result.value;
      }

      const product = config.products[index];
      const productId = product?.id ?? "unknown";
      const errorMessage = getErrorMessage(result.reason);

      logger.error(
        {
          event: "price_check_failed",
          productId,
          productName: product?.name ?? "unknown",
          productUrl: product?.url ?? "unknown",
          source: config.priceSource.type,
          checkedAt: new Date().toISOString(),
          status: "failure",
          errorMessage,
        },
        "Price check failed unexpectedly",
      );

      return {
        productId,
        status: "failure",
        errorMessage,
      };
    });
    const completedAt = new Date().toISOString();
    const runResult: MonitorRunResult = {
      startedAt,
      completedAt,
      totalProducts: config.products.length,
      succeeded: productResults.filter((result) => result.status === "success").length,
      failed: productResults.filter((result) => result.status === "failure").length,
      notificationsSent: productResults.filter((result) => result.notificationStatus === "sent").length,
      notificationsFailed: productResults.filter((result) => result.notificationStatus === "failed").length,
      productResults,
    };

    logger.info(
      {
        event: "monitor_run_completed",
        started_at: startedAt,
        completed_at: completedAt,
        total_products: runResult.totalProducts,
        succeeded: runResult.succeeded,
        failed: runResult.failed,
        notifications_sent: runResult.notificationsSent,
        notifications_failed: runResult.notificationsFailed,
      },
      "Monitor run completed",
    );

    return runResult;
  }

  private async checkProduct(product: ProductConfig): Promise<ProductCheckResult> {
    const { config, priceSource, repository, logger } = this.dependencies;

    logger.info(
      {
        event: "price_check_started",
        productId: product.id,
        productName: product.name,
        productUrl: product.url,
        source: config.priceSource.type,
        checkedAt: new Date().toISOString(),
        status: "started",
      },
      "Price check started",
    );

    let currentPriceResult: Awaited<ReturnType<PriceSource["getCurrentPrice"]>>;

    try {
      currentPriceResult = await priceSource.getCurrentPrice(product);
    } catch (error) {
      return this.handleUnexpectedProductFailure(product, error);
    }

    let previousPriceCheck: ReturnType<PriceHistoryRepository["getLatestSuccessfulPriceCheck"]>;

    try {
      previousPriceCheck = repository.getLatestSuccessfulPriceCheck(product.id);
    } catch (error) {
      return this.handleUnexpectedProductFailure(product, error, {
        currentPriceCents: currentPriceResult.ok ? currentPriceResult.price.priceCents : null,
        currency: currentPriceResult.ok ? currentPriceResult.price.currency : null,
      });
    }

    if (!currentPriceResult.ok) {
      const checkedAt = new Date().toISOString();

      const recorded = this.tryRecordPriceCheck({
        productId: product.id,
        productName: product.name,
        productUrl: product.url,
        checkedAt,
        priceCents: null,
        currency: null,
        status: "failure",
        errorMessage: currentPriceResult.message,
        source: config.priceSource.type,
      });

      logger.warn(
        {
          event: "price_check_failed",
          productId: product.id,
          productName: product.name,
          productUrl: product.url,
          source: config.priceSource.type,
          reason: currentPriceResult.reason,
          errorMessage: currentPriceResult.message,
          checkedAt,
          status: "failure",
          persisted: recorded,
        },
        "Price check failed",
      );

      return {
        productId: product.id,
        status: "failure",
        errorMessage: currentPriceResult.message,
      };
    }

    const checkedAt = currentPriceResult.price.fetchedAt.toISOString();
    const recorded = this.tryRecordPriceCheck({
      productId: product.id,
      productName: product.name,
      productUrl: product.url,
      checkedAt,
      priceCents: currentPriceResult.price.priceCents,
      currency: currentPriceResult.price.currency,
      status: "success",
      source: currentPriceResult.price.source,
    });

    if (!recorded) {
      return {
        productId: product.id,
        status: "failure",
        errorMessage: "Price check succeeded but could not be persisted",
      };
    }

    let notificationStatus: ProductCheckResult["notificationStatus"];

    if (previousPriceCheck?.priceCents != null) {
      const dropEvent = detectPriceDrop({
        productId: product.id,
        productName: product.name,
        productUrl: product.url,
        previousPriceCents: previousPriceCheck.priceCents,
        currentPriceCents: currentPriceResult.price.priceCents,
        minPercentDrop: config.dropDetection.minPercentDrop,
        minAbsoluteDropCents: config.dropDetection.minAbsoluteDropCents,
        checkedAt,
      });

      if (dropEvent !== null) {
        logger.info(
          {
            event: "price_drop_detected",
            productId: product.id,
            productName: product.name,
            productUrl: product.url,
            source: currentPriceResult.price.source,
            checkedAt,
            status: "detected",
            previousPriceCents: dropEvent.previousPriceCents,
            currentPriceCents: dropEvent.currentPriceCents,
            dropAmountCents: dropEvent.dropAmountCents,
            dropPercent: dropEvent.dropPercent,
          },
          "Price drop detected",
        );

        const notificationResult = await this.sendNotification(dropEvent);
        notificationStatus = notificationResult.status;

        const notificationRecorded = this.tryRecordNotification({
          productId: dropEvent.productId,
          productName: dropEvent.productName,
          previousPriceCents: dropEvent.previousPriceCents,
          currentPriceCents: dropEvent.currentPriceCents,
          dropAmountCents: dropEvent.dropAmountCents,
          dropPercent: dropEvent.dropPercent,
          sentAt: notificationResult.sentAt,
          status: notificationResult.status,
          errorMessage: notificationResult.errorMessage ?? null,
        });

        logger[notificationResult.status === "sent" ? "info" : "error"](
          {
            event: notificationResult.status === "sent" ? "notification_sent" : "notification_failed",
            productId: product.id,
            productName: product.name,
            productUrl: product.url,
            source: currentPriceResult.price.source,
            checkedAt,
            status: notificationResult.status,
            previousPriceCents: dropEvent.previousPriceCents,
            currentPriceCents: dropEvent.currentPriceCents,
            dropAmountCents: dropEvent.dropAmountCents,
            dropPercent: dropEvent.dropPercent,
            sentAt: notificationResult.sentAt,
            errorMessage: notificationResult.errorMessage,
            persisted: notificationRecorded,
          },
          notificationResult.status === "sent" ? "Notification sent" : "Notification failed",
        );
      }
    }

    logger.info(
      {
        event: "price_check_succeeded",
        productId: product.id,
        productName: product.name,
        productUrl: product.url,
        priceCents: currentPriceResult.price.priceCents,
        currency: currentPriceResult.price.currency,
        previousPriceCents: previousPriceCheck?.priceCents ?? null,
        source: currentPriceResult.price.source,
        checkedAt,
        status: "success",
        persisted: true,
      },
      "Price check succeeded",
    );

    const result: ProductCheckResult = {
      productId: product.id,
      status: "success",
    };

    if (notificationStatus !== undefined) {
      result.notificationStatus = notificationStatus;
    }

    return result;
  }

  private async sendNotification(
    event: Parameters<Notifier["notifyPriceDrop"]>[0],
  ): Promise<NotificationResult> {
    try {
      return await this.dependencies.notifier.notifyPriceDrop(event);
    } catch (error) {
      return {
        status: "failed",
        sentAt: new Date().toISOString(),
        errorMessage: getErrorMessage(error),
      };
    }
  }

  private tryRecordPriceCheck(input: RecordPriceCheckInput): boolean {
    try {
      this.dependencies.repository.recordPriceCheck(input);
      return true;
    } catch (error) {
      this.dependencies.logger.error(
        {
          event: "price_check_record_failed",
          productId: input.productId,
          productName: input.productName,
          productUrl: input.productUrl,
          source: input.source,
          checkedAt: toIsoString(input.checkedAt),
          status: input.status,
          errorMessage: getErrorMessage(error),
        },
        "Failed to persist price check",
      );
      return false;
    }
  }

  private tryRecordNotification(input: RecordNotificationInput): boolean {
    try {
      this.dependencies.repository.recordNotification(input);
      return true;
    } catch (error) {
      this.dependencies.logger.error(
        {
          event: "notification_record_failed",
          productId: input.productId,
          productName: input.productName,
          checkedAt: toIsoString(input.sentAt),
          status: input.status,
          errorMessage: getErrorMessage(error),
          previousPriceCents: input.previousPriceCents,
          currentPriceCents: input.currentPriceCents,
          dropAmountCents: input.dropAmountCents,
          dropPercent: input.dropPercent,
        },
        "Failed to persist notification result",
      );
      return false;
    }
  }

  private handleUnexpectedProductFailure(
    product: ProductConfig,
    error: unknown,
    priceDetails: { currentPriceCents: number | null; currency: string | null } = {
      currentPriceCents: null,
      currency: null,
    },
  ): ProductCheckResult {
    const { config, logger } = this.dependencies;
    const checkedAt = new Date().toISOString();
    const errorMessage = getErrorMessage(error);
    const recorded = this.tryRecordPriceCheck({
      productId: product.id,
      productName: product.name,
      productUrl: product.url,
      checkedAt,
      priceCents: priceDetails.currentPriceCents,
      currency: priceDetails.currency,
      status: "failure",
      errorMessage,
      source: config.priceSource.type,
    });

    logger.error(
      {
        event: "price_check_failed",
        productId: product.id,
        productName: product.name,
        productUrl: product.url,
        source: config.priceSource.type,
        checkedAt,
        status: "failure",
        errorMessage,
        persisted: recorded,
      },
      "Price check failed unexpectedly",
    );

    return {
      productId: product.id,
      status: "failure",
      errorMessage,
    };
  }
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function toIsoString(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : value;
}
