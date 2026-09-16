export const RETURN_WINDOW_DAYS = 7;
export const RETURN_SHIP_DAYS = 5;
export const RETURN_INSPECTION_HOURS = 48;
export const RETURN_POLICY_TEXT = "Returns allowed: request within 7 calendar days of delivery and hand the package to the carrier within 5 calendar days of approval. You pay for the return label. The full item price is refunded after the carrier accepts the return; original shipping is not refunded. No partial refunds. Sellers have 48 hours after return delivery to report an issue.";

export function cents(value: number): number {
  const result = Math.round(value * 100);
  if (!Number.isFinite(value) || !Number.isSafeInteger(result) || result < 0) throw new Error("Invalid money amount");
  return result;
}

export function returnRequestError(order: { returnPolicy: string; status: string; deliveredAt: string | null }, now = Date.now()) {
  if (order.returnPolicy === "no_returns") return "This order does not accept returns. You can still report an issue.";
  if (["pending_payment", "failed", "canceled", "refunded"].includes(order.status)) return "This order is not eligible for a return.";
  const delivered = order.deliveredAt ? Date.parse(order.deliveredAt) : NaN;
  if (!Number.isFinite(delivered) || delivered > now) return "Returns can be requested after delivery.";
  if (now > delivered + RETURN_WINDOW_DAYS * 86400000) return "The 7-day return window has ended.";
  return null;
}

// Allocate the actual original transfer, including rounding, across all items.
// Stable ordering makes refunds independent of which item is returned first.
export function allocateSellerTransfer(items: { id: string; subtotal: number }[], transferCents: number) {
  const sorted = [...items].sort((a, b) => a.id.localeCompare(b.id));
  const total = sorted.reduce((sum, item) => sum + cents(item.subtotal), 0);
  if (total <= 0 || transferCents < 0 || transferCents > total || !Number.isSafeInteger(transferCents)) throw new Error("Invalid seller transfer");
  let running = 0;
  let allocated = 0;
  return Object.fromEntries(sorted.map(item => {
    running += cents(item.subtotal);
    const cumulative = Math.round(running * transferCents / total);
    const share = cumulative - allocated;
    allocated = cumulative;
    return [item.id, share];
  }));
}

export type CarrierScan = { status?: string; status_date?: string };
export function firstAcceptedScan(scans: CarrierScan[], approvedAt: string, shipBy: string) {
  const lower = Date.parse(approvedAt);
  const upper = Math.min(Date.parse(shipBy), Date.now() + 300000);
  return scans.filter(scan => ["TRANSIT", "DELIVERED"].includes(scan.status || ""))
    .map(scan => Date.parse(scan.status_date || ""))
    .filter(time => Number.isFinite(time) && time >= lower && time <= upper)
    .sort((a, b) => a - b)[0] ?? null;
}
