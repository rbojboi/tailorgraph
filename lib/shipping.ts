import type { Listing } from "@/lib/types";

const categoryBaseRate: Record<Listing["category"], number> = {
  jacket: 16,
  two_piece_suit: 22,
  three_piece_suit: 26,
  waistcoat: 12,
  trousers: 12,
  coat: 24,
  shirt: 10,
  sweater: 14
};

export function estimateShippingCost(category: Listing["category"], sizeLabel: string) {
  const normalizedSize = sizeLabel.trim().toUpperCase();
  const oversizedAdjustment = /4[6-9]|5\d|XXL|XXXL/.test(normalizedSize) ? 4 : 0;
  return categoryBaseRate[category] + oversizedAdjustment;
}

export function estimateTailoringDistanceFromSellerLocation(location: string) {
  const normalized = location.trim().toLowerCase();

  if (!normalized) {
    return 60;
  }

  if (normalized.includes("new york") || normalized.includes("brooklyn") || normalized.includes("jersey")) {
    return 14;
  }

  if (normalized.includes("chicago") || normalized.includes("boston") || normalized.includes("philadelphia")) {
    return 26;
  }

  if (normalized.includes("los angeles") || normalized.includes("san francisco") || normalized.includes("seattle")) {
    return 38;
  }

  return 32;
}
