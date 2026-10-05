import type Stripe from "stripe";
import { commerceLock, getPaymentStripe } from "./commerce-common";
import { requirePool } from "./store";
import { processReturn } from "./returns";

// Webhooks can be duplicated or arrive out of order. Only the current provider
// record determines state. External refunds never initiate refunds or reversals;
// managed returns retain their existing, idempotent seller-recovery workflow.
export async function reconcilePaymentRefund(paymentIntentId: string) {
  return commerceLock(`refund:${paymentIntentId}`, async () => {
    const db = requirePool();
    const stripe = getPaymentStripe();
    const intent = await stripe.paymentIntents.retrieve(paymentIntentId, { expand: ['latest_charge'] });
    let orders = await db.query("SELECT id FROM orders WHERE stripe_payment_intent_id=$1", [paymentIntentId]);
    // A refund can reach us before checkout completion records the payment ID.
    if (!orders.rows.length && intent.metadata?.paymentAttempt) {
      const attempt = (await db.query("SELECT * FROM commerce_payments WHERE id=$1", [intent.metadata.paymentAttempt])).rows[0];
      if (attempt && (!attempt.payment_intent_id || attempt.payment_intent_id === intent.id) &&
          intent.currency === 'usd' && intent.amount === attempt.provider_params.totalCents) {
        await db.query("UPDATE orders SET stripe_payment_intent_id=$2 WHERE id=ANY($1::text[]) AND stripe_payment_intent_id IS NULL", [attempt.order_ids,intent.id]);
        orders = await db.query("SELECT id FROM orders WHERE stripe_payment_intent_id=$1", [paymentIntentId]);
      }
    }
    if (!orders.rows.length) return;
    const charge = intent.latest_charge as Stripe.Charge | null;
    if (!charge || typeof charge === 'string') throw new Error('Original charge is unavailable');
    const external: Stripe.Refund[] = [];
    let confirmedRefundCents = 0;
    for await (const refund of stripe.refunds.list({ payment_intent: paymentIntentId, limit: 100 })) {
      if (refund.status === 'succeeded') confirmedRefundCents += refund.amount;
      const orderId = refund.metadata?.tailorgraphReturn;
      const managed = orderId && orders.rows.some(o => o.id === orderId) &&
        (await db.query("SELECT 1 FROM order_returns WHERE order_id=$1", [orderId])).rows.length;
      if (managed) await processReturn(orderId!, { refreshRefund: true });
      else external.push(refund);
    }
    if (!external.length) return;
    const full = charge.amount_refunded === charge.amount && confirmedRefundCents === charge.amount && charge.amount > 0;
    const state = full ? 'fully_refunded' : 'needs_review';
    const details = external.map(r => `${r.id}: ${r.status || 'pending'} (${r.amount} ${r.currency || intent.currency})`).sort().join('; ');
    const client = await db.connect();
    try {
      await client.query('BEGIN');
      const changed = await client.query(`INSERT INTO payment_refund_reviews(payment_intent_id,charge_id,amount_refunded,state,details)
        VALUES($1,$2,$3,$4,$5) ON CONFLICT(payment_intent_id) DO UPDATE SET amount_refunded=$3,state=$4,details=$5,updated_at=NOW()
        WHERE payment_refund_reviews.amount_refunded IS DISTINCT FROM $3 OR payment_refund_reviews.state IS DISTINCT FROM $4
          OR payment_refund_reviews.details IS DISTINCT FROM $5 RETURNING payment_intent_id`,
        [paymentIntentId,charge.id,charge.amount_refunded,state,details]);
      if (changed.rowCount) {
        await client.query(`UPDATE commerce_payments SET state='review',error_code='external_refund_review',updated_at=NOW()
          WHERE order_ids && $1::text[] AND state<>'paid'`, [orders.rows.map(o=>o.id)]);
        await client.query(`UPDATE orders SET status=$2,issue_reason='Stripe refund requires payment and seller transfer review'
          WHERE stripe_payment_intent_id=$1`, [paymentIntentId,full?'refunded':'issue_open']);
        await client.query("INSERT INTO notification_events(kind,payload) VALUES('payment_refund',$1)", [JSON.stringify({paymentIntentId,full})]);
      }
      await client.query('COMMIT');
    } catch (error) { await client.query('ROLLBACK'); throw error; }
    finally { client.release(); }
  });
}
