export const NOTIFICATION_SCHEMA = `
CREATE TABLE IF NOT EXISTS email_delivery_log (
 event_key TEXT PRIMARY KEY, recipient TEXT NOT NULL, category TEXT NOT NULL,
 event_type TEXT NOT NULL, subject TEXT NOT NULL, provider_id TEXT UNIQUE,
 status TEXT NOT NULL DEFAULT 'queued', last_error TEXT, provider_checked_at TIMESTAMPTZ,
 created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS email_delivery_status_idx ON email_delivery_log(status, created_at);
CREATE TABLE IF NOT EXISTS email_suppressions (email TEXT PRIMARY KEY, reason TEXT NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
CREATE TABLE IF NOT EXISTS email_digest_items (
 event_key TEXT PRIMARY KEY, recipient_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 preference_key TEXT NOT NULL, payload JSONB, processed_at TIMESTAMPTZ, available_at TIMESTAMPTZ NOT NULL,
 created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS email_digest_due_idx ON email_digest_items(available_at);
CREATE TABLE IF NOT EXISTS notification_events (
 id BIGSERIAL PRIMARY KEY, kind TEXT NOT NULL, payload JSONB NOT NULL,
 created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), completed_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS notification_events_pending_idx ON notification_events(id) WHERE completed_at IS NULL;
CREATE TABLE IF NOT EXISTS email_worker_health (id INTEGER PRIMARY KEY CHECK(id=1), last_success_at TIMESTAMPTZ NOT NULL);
ALTER TABLE offers ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;
ALTER TABLE offers ALTER COLUMN expires_at SET DEFAULT NOW()+INTERVAL '7 days';
ALTER TABLE offers ADD COLUMN IF NOT EXISTS last_actor_id TEXT;
ALTER TABLE offers ADD COLUMN IF NOT EXISTS revision INTEGER NOT NULL DEFAULT 0;
UPDATE offers SET expires_at=created_at+INTERVAL '7 days',last_actor_id=buyer_id WHERE expires_at IS NULL;
UPDATE offers SET status='expired' WHERE expires_at<=NOW() AND status IN ('active','countered','accepted');
CREATE INDEX IF NOT EXISTS offers_expiry_idx ON offers(expires_at) WHERE status IN ('active','countered','accepted');
ALTER TABLE orders ADD COLUMN IF NOT EXISTS paid_at TIMESTAMPTZ;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS ship_by_at TIMESTAMPTZ;

CREATE OR REPLACE FUNCTION tailorgraph_notification_event() RETURNS trigger AS $$
BEGIN
 IF TG_TABLE_NAME='listings' THEN
  IF NEW.status='active' AND (TG_OP='INSERT' OR OLD.status='draft') THEN
   INSERT INTO notification_events(kind,payload) VALUES('listing_published',jsonb_build_object('listingId',NEW.id));
  ELSIF TG_OP='UPDATE' AND NEW.status='active' AND OLD.status='active' AND NEW.price<OLD.price THEN
   INSERT INTO notification_events(kind,payload) VALUES('price_drop',jsonb_build_object('listingId',NEW.id,'oldPrice',OLD.price,'newPrice',NEW.price));
  END IF;
 ELSIF TG_TABLE_NAME='offers' THEN
  IF TG_OP='INSERT' OR NEW.revision<>OLD.revision THEN
   INSERT INTO notification_events(kind,payload) VALUES('offer_changed',jsonb_build_object(
    'offerId',NEW.id,'buyerId',NEW.buyer_id,'sellerId',NEW.seller_id,'listingId',NEW.listing_id,
    'amount',NEW.amount,'status',NEW.status,'actorId',COALESCE(NEW.last_actor_id,NEW.buyer_id),'revision',NEW.revision));
  END IF;
 END IF;
 RETURN NEW;
END; $$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS tailorgraph_listing_notifications ON listings;
CREATE TRIGGER tailorgraph_listing_notifications AFTER INSERT OR UPDATE ON listings FOR EACH ROW EXECUTE FUNCTION tailorgraph_notification_event();
DROP TRIGGER IF EXISTS tailorgraph_offer_notifications ON offers;
CREATE TRIGGER tailorgraph_offer_notifications AFTER INSERT OR UPDATE ON offers FOR EACH ROW EXECUTE FUNCTION tailorgraph_notification_event();

CREATE OR REPLACE FUNCTION tailorgraph_shipping_deadline() RETURNS trigger AS $$
DECLARE days_left INTEGER; deadline TIMESTAMPTZ;
BEGIN
 IF NEW.status IN ('paid','processing') AND NEW.paid_at IS NULL AND (TG_OP='INSERT' OR OLD.status='pending_payment') THEN
  NEW.paid_at=NOW();
  SELECT LEAST(30,GREATEST(1,COALESCE(processing_days,3))) INTO days_left FROM listings WHERE id=NEW.listing_id;
  days_left=COALESCE(days_left,3); deadline=NEW.paid_at;
  WHILE days_left>0 LOOP
   deadline=deadline+INTERVAL '1 day';
   IF EXTRACT(ISODOW FROM deadline AT TIME ZONE 'UTC')<6 THEN days_left=days_left-1; END IF;
  END LOOP;
  NEW.ship_by_at=deadline;
 END IF;
 RETURN NEW;
END; $$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS tailorgraph_order_deadline ON orders;
CREATE TRIGGER tailorgraph_order_deadline BEFORE INSERT OR UPDATE ON orders FOR EACH ROW EXECUTE FUNCTION tailorgraph_shipping_deadline();
`;
