export interface DetectPriceDropInput {
  productId: string;
  productName: string;
  productUrl: string;
  previousPriceCents: number;
  currentPriceCents: number;
  minPercentDrop: number;
  minAbsoluteDropCents: number;
  checkedAt: Date | string;
}

export interface PriceDropEvent {
  productId: string;
  productName: string;
  productUrl: string;
  previousPriceCents: number;
  currentPriceCents: number;
  dropAmountCents: number;
  dropPercent: number;
  checkedAt: string;
}

export function detectPriceDrop(input: DetectPriceDropInput): PriceDropEvent | null {
  if (!isValidPositivePrice(input.previousPriceCents) || !isValidPositivePrice(input.currentPriceCents)) {
    return null;
  }

  if (input.currentPriceCents >= input.previousPriceCents) {
    return null;
  }

  const dropAmountCents = input.previousPriceCents - input.currentPriceCents;
  const dropPercent = (dropAmountCents / input.previousPriceCents) * 100;
  const meetsPercentThreshold = dropPercent >= input.minPercentDrop;
  const meetsAbsoluteThreshold = dropAmountCents >= input.minAbsoluteDropCents;

  if (!meetsPercentThreshold && !meetsAbsoluteThreshold) {
    return null;
  }

  return {
    productId: input.productId,
    productName: input.productName,
    productUrl: input.productUrl,
    previousPriceCents: input.previousPriceCents,
    currentPriceCents: input.currentPriceCents,
    dropAmountCents,
    dropPercent,
    checkedAt: input.checkedAt instanceof Date ? input.checkedAt.toISOString() : input.checkedAt,
  };
}

function isValidPositivePrice(value: number): boolean {
  return Number.isFinite(value) && Number.isInteger(value) && value > 0;
}
