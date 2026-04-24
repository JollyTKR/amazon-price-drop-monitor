import pLimit from "p-limit";
import type { Logger } from "pino";

import { detectPriceDrop } from "./PriceDropDetector.js";
import type { NotificationResult, Notifier } from "../notification/Notifier.js";
import type { PriceSource } from "../price-source/PriceSource.js";
import type { PriceHistoryRepository } from "../storage/PriceHistoryRepository.js";
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
          product_id: productId,
          error_message: errorMessage,
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
    const { config, priceSource, repository, notifier, logger } = this.dependencies;

    logger.info(
      {
        event: "price_check_started",
        product_id: product.id,
        product_name: product.name,
        product_url: product.url,
        source: config.priceSource.type,
      },
      "Price check started",
    );

    const currentPriceResult = await priceSource.getCurrentPrice(product);
    const previousPriceCheck = repository.getLatestSuccessfulPriceCheck(product.id);

    if (!currentPriceResult.ok) {
      const checkedAt = new Date().toISOString();

      repository.recordPriceCheck({
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
          product_id: product.id,
          product_name: product.name,
          product_url: product.url,
          source: config.priceSource.type,
          reason: currentPriceResult.reason,
          error_message: currentPriceResult.message,
          checked_at: checkedAt,
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
    repository.recordPriceCheck({
      productId: product.id,
      productName: product.name,
      productUrl: product.url,
      checkedAt,
      priceCents: currentPriceResult.price.priceCents,
      currency: currentPriceResult.price.currency,
      status: "success",
      source: currentPriceResult.price.source,
    });

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
            product_id: product.id,
            product_name: product.name,
            previous_price_cents: dropEvent.previousPriceCents,
            current_price_cents: dropEvent.currentPriceCents,
            drop_amount_cents: dropEvent.dropAmountCents,
            drop_percent: dropEvent.dropPercent,
            checked_at: checkedAt,
          },
          "Price drop detected",
        );

        const notificationResult = await this.sendNotification(dropEvent);
        notificationStatus = notificationResult.status;

        repository.recordNotification({
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
            product_id: product.id,
            product_name: product.name,
            previous_price_cents: dropEvent.previousPriceCents,
            current_price_cents: dropEvent.currentPriceCents,
            drop_amount_cents: dropEvent.dropAmountCents,
            drop_percent: dropEvent.dropPercent,
            sent_at: notificationResult.sentAt,
            error_message: notificationResult.errorMessage,
          },
          notificationResult.status === "sent" ? "Notification sent" : "Notification failed",
        );
      }
    }

    logger.info(
      {
        event: "price_check_succeeded",
        product_id: product.id,
        product_name: product.name,
        product_url: product.url,
        price_cents: currentPriceResult.price.priceCents,
        currency: currentPriceResult.price.currency,
        previous_price_cents: previousPriceCheck?.priceCents ?? null,
        source: currentPriceResult.price.source,
        checked_at: checkedAt,
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
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
