import { z } from "zod";

import { NOTIFICATION_TYPES, PRICE_SOURCE_TYPES } from "../types/domain.js";
import type { AppConfig } from "../types/domain.js";

const requiredString = (fieldName: string) =>
  z.string({
    error: `${fieldName} is required and must be a string`,
  }).min(1, `${fieldName} cannot be empty`);

export const productConfigSchema = z.object({
  id: requiredString("products[].id"),
  name: requiredString("products[].name"),
  url: requiredString("products[].url"),
  fixturePath: requiredString("products[].fixturePath"),
});

export const appConfigSchema = z.object({
  database: z.object({
    path: requiredString("database.path"),
  }),
  priceSource: z.object({
    type: z.enum(PRICE_SOURCE_TYPES, {
      error: "priceSource.type must be fixture-html",
    }),
  }),
  scheduler: z.object({
    intervalSeconds: z
      .number({ error: "scheduler.intervalSeconds is required and must be a number" })
      .int("scheduler.intervalSeconds must be a whole number")
      .positive("scheduler.intervalSeconds must be positive"),
    runOnStartup: z.boolean({
      error: "scheduler.runOnStartup is required and must be true or false",
    }),
    maxConcurrentChecks: z
      .number({ error: "scheduler.maxConcurrentChecks is required and must be a number" })
      .int("scheduler.maxConcurrentChecks must be a whole number")
      .positive("scheduler.maxConcurrentChecks must be positive"),
  }),
  dropDetection: z.object({
    minPercentDrop: z
      .number({ error: "dropDetection.minPercentDrop is required and must be a number" })
      .min(0, "dropDetection.minPercentDrop cannot be negative"),
    minAbsoluteDropCents: z
      .number({ error: "dropDetection.minAbsoluteDropCents is required and must be a number" })
      .int("dropDetection.minAbsoluteDropCents must be a whole number of cents")
      .min(0, "dropDetection.minAbsoluteDropCents cannot be negative"),
  }),
  notification: z.object({
    type: z.enum(NOTIFICATION_TYPES, {
      error: "notification.type must be console or file",
    }),
    filePath: requiredString("notification.filePath").default("data/notifications.log"),
  }),
  server: z.object({
    port: z
      .number({ error: "server.port is required and must be a number" })
      .int("server.port must be a whole number")
      .min(1, "server.port must be between 1 and 65535")
      .max(65535, "server.port must be between 1 and 65535"),
  }),
  products: z
    .array(productConfigSchema, {
      error: "products is required and must be an array",
    })
    .min(3, "At least 3 products must be configured")
    .superRefine((products, context) => {
      const seenProductIds = new Set<string>();

      products.forEach((product, index) => {
        if (seenProductIds.has(product.id)) {
          context.addIssue({
            code: "custom",
            message: `Product id "${product.id}" must be unique`,
            path: [index, "id"],
          });
          return;
        }

        seenProductIds.add(product.id);
      });
    }),
}) satisfies z.ZodType<AppConfig>;

export type ValidatedAppConfig = z.infer<typeof appConfigSchema>;
