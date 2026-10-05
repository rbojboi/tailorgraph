import { commerceLock } from "./commerce-common";
import { findOrderById, requirePool, updateOrderShippingWithProvider } from "./store";
import { purchaseShippoLabelForRate, recoverShippoOutboundLabel, type ShippoLabelPurchase, type ShippoShipmentQuote, type ShippoRateOption } from "./shippo";

type Attempt = { order_id: string; shipment_id: string; rate_id: string; rate: ShippoRateOption; seller_notes: string | null; label: ShippoLabelPurchase | null; state: string };

export async function saveOutboundQuote(orderId: string, quote: ShippoShipmentQuote) {
  await requirePool().query("INSERT INTO outbound_quotes(shipment_id,order_id,rates) VALUES($1,$2,$3) ON CONFLICT DO NOTHING", [quote.shipmentId, orderId, JSON.stringify(quote.rates)]);
}

async function finish(attempt: Attempt, label: ShippoLabelPurchase) {
  const db = requirePool();
  await db.query("UPDATE outbound_labels SET label=$2,state='label_purchased',error=NULL WHERE order_id=$1", [attempt.order_id, JSON.stringify(label)]);
  await updateOrderShippingWithProvider(attempt.order_id, { ...label, sellerNotes: attempt.seller_notes });
  await db.query("UPDATE outbound_labels SET state='complete' WHERE order_id=$1", [attempt.order_id]);
  return label;
}

export async function buyOutboundLabel(orderId: string, sellerId: string, shipmentId: string, rateId: string, notes: string | null) {
  return commerceLock(`shipment:${orderId}`, async () => {
    const db = requirePool();
    const order = await findOrderById(orderId);
    if (!order || order.sellerId !== sellerId) throw new Error("Order not found");
    const prior = (await db.query<Attempt>("SELECT * FROM outbound_labels WHERE order_id=$1", [orderId])).rows[0];
    if (prior?.state === "complete" && prior.label) return prior.label;
    if (!['paid','processing'].includes(order.status)) throw new Error("Payment must be confirmed before shipping");
    if (prior?.label) return finish(prior, prior.label);
    if (prior) throw new Error("This label purchase needs support review. Do not purchase another label; support can recover the existing Shippo transaction.");
    const quote = (await db.query("SELECT rates FROM outbound_quotes WHERE shipment_id=$1 AND order_id=$2 AND created_at>NOW()-INTERVAL '30 minutes'", [shipmentId, orderId])).rows[0];
    const rate = (quote?.rates as ShippoRateOption[] | undefined)?.find(r => r.rateId === rateId);
    if (!rate || rate.amount === null || rate.amount <= 0 || rate.currency?.toUpperCase() !== 'USD') throw new Error("Refresh the shipping rates and select an available USD rate.");
    // Persist the intent before the paid API call. A timeout or process crash is
    // ambiguous, so subsequent requests may only recover, never repurchase.
    const result = await db.query<Attempt>(`INSERT INTO outbound_labels(order_id,shipment_id,rate_id,rate,seller_notes)
      SELECT id,$2,$3,$4,$5 FROM orders WHERE id=$1 AND status IN ('paid','processing') RETURNING *`, [orderId, shipmentId, rateId, JSON.stringify(rate), notes]);
    const attempt = result.rows[0];
    if (!attempt) throw new Error("Order is no longer available to ship");
    try {
      const label = await purchaseShippoLabelForRate({ orderId, shipmentId, rateId, rate, metadata: `outbound-label:${orderId}` });
      return await finish(attempt, label);
    } catch (error) {
      await db.query("UPDATE outbound_labels SET state='needs_attention',error=$2 WHERE order_id=$1", [orderId, error instanceof Error ? error.message : 'Label purchase needs review']);
      throw error;
    }
  });
}

export async function recoverOutboundLabel(orderId: string, transactionId: string) {
  return commerceLock(`shipment:${orderId}`, async () => {
    const attempt = (await requirePool().query<Attempt>("SELECT * FROM outbound_labels WHERE order_id=$1", [orderId])).rows[0];
    if (!attempt || attempt.state === 'complete') throw new Error("No label needs recovery");
    return finish(attempt, attempt.label || await recoverShippoOutboundLabel(transactionId, orderId, attempt.shipment_id, attempt.rate_id));
  });
}
