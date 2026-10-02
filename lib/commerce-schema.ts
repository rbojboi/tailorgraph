export const COMMERCE_SCHEMA = `
ALTER TABLE offers ADD COLUMN IF NOT EXISTS auto_charge BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE offers ADD COLUMN IF NOT EXISTS authorization_id TEXT;
ALTER TABLE offers ADD COLUMN IF NOT EXISTS payment_state TEXT;
ALTER TABLE offers ADD COLUMN IF NOT EXISTS paid_order_id TEXT;
CREATE TABLE IF NOT EXISTS offer_authorizations (
 id TEXT PRIMARY KEY, offer_id TEXT NOT NULL REFERENCES offers(id), buyer_id TEXT NOT NULL REFERENCES users(id),
 revision INTEGER NOT NULL, purpose TEXT NOT NULL, amount_cents INTEGER NOT NULL CHECK(amount_cents>=50),
 shipping_cents INTEGER NOT NULL CHECK(shipping_cents>=0), shipping_address JSONB,
 seller_account_id TEXT NOT NULL, consent_text TEXT, consented_at TIMESTAMPTZ,
 state TEXT NOT NULL DEFAULT 'draft', customer_id TEXT, setup_session_id TEXT UNIQUE,
 setup_intent_id TEXT, payment_method_id TEXT, checked_at TIMESTAMPTZ, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
 expires_at TIMESTAMPTZ NOT NULL DEFAULT NOW()+INTERVAL '7 days'
);
CREATE TABLE IF NOT EXISTS commerce_payments (
 id TEXT PRIMARY KEY, kind TEXT NOT NULL, buyer_id TEXT NOT NULL REFERENCES users(id), offer_id TEXT UNIQUE REFERENCES offers(id),
 authorization_id TEXT REFERENCES offer_authorizations(id), listing_ids TEXT[] NOT NULL, order_ids TEXT[] NOT NULL DEFAULT '{}',
 state TEXT NOT NULL DEFAULT 'creating', provider_params JSONB NOT NULL, session_id TEXT UNIQUE,
 payment_intent_id TEXT UNIQUE, recovery_params JSONB, recovery_started_at TIMESTAMPTZ,
 created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
 expires_at TIMESTAMPTZ NOT NULL, error_code TEXT
);
CREATE INDEX IF NOT EXISTS commerce_payments_pending_idx ON commerce_payments(updated_at) WHERE state NOT IN ('paid','canceled');
CREATE TABLE IF NOT EXISTS listing_payment_claims (
 listing_id TEXT PRIMARY KEY REFERENCES listings(id), payment_id TEXT NOT NULL REFERENCES commerce_payments(id)
);
CREATE TABLE IF NOT EXISTS commerce_locks (key TEXT PRIMARY KEY,token TEXT NOT NULL,expires_at TIMESTAMPTZ NOT NULL);

CREATE OR REPLACE FUNCTION tailorgraph_offer_payment_event() RETURNS trigger AS $$
BEGIN
 IF NEW.status NOT IN ('draft','authorizing') AND (TG_OP='INSERT' OR NEW.revision<>OLD.revision OR NEW.payment_state IS DISTINCT FROM OLD.payment_state) THEN
  INSERT INTO notification_events(kind,payload) VALUES('offer_changed',jsonb_build_object(
   'offerId',NEW.id,'buyerId',NEW.buyer_id,'sellerId',NEW.seller_id,'listingId',NEW.listing_id,
   'amount',NEW.amount,'status',NEW.status,'actorId',COALESCE(NEW.last_actor_id,NEW.buyer_id),
   'revision',NEW.revision,'autoCharge',NEW.auto_charge,'paymentState',NEW.payment_state,'orderId',NEW.paid_order_id));
 END IF;
 RETURN NEW;
END; $$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS tailorgraph_offer_notifications ON offers;
CREATE TRIGGER tailorgraph_offer_notifications AFTER INSERT OR UPDATE ON offers FOR EACH ROW EXECUTE FUNCTION tailorgraph_offer_payment_event();

CREATE OR REPLACE FUNCTION tailorgraph_protect_payment_claim() RETURNS trigger AS $$
BEGIN
 IF NEW.status IN ('active','draft') AND OLD.status='reserved' AND EXISTS(SELECT 1 FROM listing_payment_claims WHERE listing_id=NEW.id) THEN
  RAISE EXCEPTION 'This listing is reserved for a payment. Resolve the payment before changing its status.';
 END IF;
 RETURN NEW;
END; $$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS tailorgraph_payment_claim ON listings;
CREATE TRIGGER tailorgraph_payment_claim BEFORE UPDATE ON listings FOR EACH ROW EXECUTE FUNCTION tailorgraph_protect_payment_claim();
`;
