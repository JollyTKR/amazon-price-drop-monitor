import Fastify, { type FastifyInstance } from "fastify";
import type { Logger } from "pino";

import {
  getProductDashboardRows,
  renderDashboardPage,
  renderProductHistoryPage,
} from "./dashboard.js";
import type { PriceHistoryRepository } from "../storage/PriceHistoryRepository.js";
import type { AppConfig } from "../types/domain.js";

export interface CreateWebServerOptions {
  config: AppConfig;
  repository: PriceHistoryRepository;
  logger: Logger;
}

export function createWebServer(options: CreateWebServerOptions): FastifyInstance {
  const server = Fastify({
    logger: false,
  });

  server.get("/", async (_request, reply) => {
    const rows = getProductDashboardRows(options.config, options.repository);
    return reply.type("text/html").send(renderDashboardPage(rows));
  });

  server.get<{ Params: { productId: string } }>(
    "/products/:productId/history",
    async (request, reply) => {
      const product = options.config.products.find((candidate) => candidate.id === request.params.productId);

      if (product === undefined) {
        return reply.status(404).type("text/html").send("<h1>Product not found</h1>");
      }

      const history = options.repository.getPriceHistory(product.id);
      return reply.type("text/html").send(renderProductHistoryPage(product, history));
    },
  );

  server.get<{ Params: { productId: string } }>(
    "/api/products/:productId/history",
    async (request, reply) => {
      const product = options.config.products.find((candidate) => candidate.id === request.params.productId);

      if (product === undefined) {
        return reply.status(404).send({
          error: "product_not_found",
          productId: request.params.productId,
        });
      }

      return reply.send({
        product: {
          id: product.id,
          name: product.name,
          url: product.url,
        },
        history: options.repository.getPriceHistory(product.id),
      });
    },
  );

  server.addHook("onResponse", async (request, reply) => {
    options.logger.info(
      {
        event: "web_request_completed",
        method: request.method,
        url: request.url,
        status_code: reply.statusCode,
      },
      "Web request completed",
    );
  });

  return server;
}
