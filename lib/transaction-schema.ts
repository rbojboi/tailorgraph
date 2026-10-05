export const TRANSACTION_SCHEMA = `
CREATE TABLE IF NOT EXISTS outbound_quotes (
 shipment_id TEXT PRIMARY KEY, order_id TEXT NOT NULL REFERENCES orders(id), rates JSONB NOT NULL,
 created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS outbound_labels (
 order_id TEXT PRIMARY KEY REFERENCES orders(id), shipment_id TEXT NOT NULL, rate_id TEXT NOT NULL,
 rate JSONB NOT NULL, seller_notes TEXT, state TEXT NOT NULL DEFAULT 'purchasing', label JSONB,
 error TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS payment_refund_reviews (
 payment_intent_id TEXT PRIMARY KEY, charge_id TEXT NOT NULL, amount_refunded INTEGER NOT NULL,
 state TEXT NOT NULL, details TEXT NOT NULL, updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE OR REPLACE FUNCTION tailorgraph_shipment_event() RETURNS trigger AS $$
BEGIN
 IF OLD.shipped_at IS NULL AND NEW.shipped_at IS NOT NULL THEN
  INSERT INTO notification_events(kind,payload) VALUES('order_shipped',jsonb_build_object('orderId',NEW.id));
 END IF;
 RETURN NEW;
END; $$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS tailorgraph_shipment_notifications ON orders;
CREATE TRIGGER tailorgraph_shipment_notifications AFTER UPDATE ON orders FOR EACH ROW EXECUTE FUNCTION tailorgraph_shipment_event();

CREATE OR REPLACE FUNCTION tailorgraph_return_event() RETURNS trigger AS $$
DECLARE event_kind TEXT;
BEGIN
 IF TG_OP='INSERT' THEN event_kind:='approved';
 ELSE
  IF OLD.received_at IS NULL AND NEW.received_at IS NOT NULL THEN
   INSERT INTO return_notification_outbox(id,order_id,kind) VALUES('return:'||NEW.order_id||':received',NEW.order_id,'received') ON CONFLICT DO NOTHING;
  END IF;
  IF NEW.refund_status='succeeded' AND OLD.refund_status<>'succeeded' THEN event_kind:='refunded'; END IF;
  IF NEW.refund_status IN ('failed','canceled','requires_action') AND NEW.refund_status IS DISTINCT FROM OLD.refund_status THEN event_kind:='refund_failed'; END IF;
  IF OLD.disputed_at IS NULL AND NEW.disputed_at IS NOT NULL THEN event_kind:='disputed'; END IF;
  IF OLD.dispute_resolution IS NULL AND NEW.dispute_resolution IS NOT NULL THEN event_kind:='reviewed'; END IF;
  IF OLD.closed_at IS NULL AND NEW.closed_at IS NOT NULL THEN
   UPDATE orders SET return_status='closed' WHERE id=NEW.order_id;
   -- The row lock also serializes this change against a concurrent checkout.
   UPDATE listings l SET status=CASE WHEN NEW.dispute_resolution LIKE 'upheld %' THEN 'archived' ELSE 'draft' END
    FROM orders o WHERE o.id=NEW.order_id AND l.id=o.listing_id AND l.status='sold'
    AND NOT EXISTS(SELECT 1 FROM orders newer WHERE newer.listing_id=l.id AND newer.id<>o.id
      AND (newer.created_at>o.created_at OR newer.status NOT IN ('refunded','canceled','failed')));
  END IF;
 END IF;
 IF event_kind IS NOT NULL THEN
  INSERT INTO return_notification_outbox(id,order_id,kind) VALUES('return:'||NEW.order_id||':'||event_kind,NEW.order_id,event_kind) ON CONFLICT DO NOTHING;
 END IF;
 RETURN NEW;
END; $$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS tailorgraph_return_notifications ON order_returns;
CREATE TRIGGER tailorgraph_return_notifications AFTER INSERT OR UPDATE ON order_returns FOR EACH ROW EXECUTE FUNCTION tailorgraph_return_event();

CREATE OR REPLACE FUNCTION tailorgraph_return_label_event() RETURNS trigger AS $$
BEGIN
 IF NEW.status='complete' AND OLD.status<>'complete' THEN
  INSERT INTO return_notification_outbox(id,order_id,kind) VALUES('return:'||NEW.order_id||':label_ready',NEW.order_id,'label_ready') ON CONFLICT DO NOTHING;
 END IF;
 RETURN NEW;
END; $$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS tailorgraph_return_label_notifications ON return_label_payments;
CREATE TRIGGER tailorgraph_return_label_notifications AFTER UPDATE ON return_label_payments FOR EACH ROW EXECUTE FUNCTION tailorgraph_return_label_event();
`;
