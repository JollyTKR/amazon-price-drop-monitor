import type { PriceSourceResult, ProductConfig } from "../types/domain.js";

export interface PriceSource {
  getCurrentPrice(product: ProductConfig): Promise<PriceSourceResult>;
}
