export const RETURNS_SCHEMA = `
CREATE TABLE IF NOT EXISTS return_workflow_locks (
  key TEXT PRIMARY KEY,
  token TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL
);
CREATE TABLE IF NOT EXISTS order_returns (
  order_id TEXT PRIMARY KEY REFERENCES orders(id),
  approved_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ship_by TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '5 days',
  accepted_at TIMESTAMPTZ,
  received_at TIMESTAMPTZ,
  closed_at TIMESTAMPTZ,
  disputed_at TIMESTAMPTZ,
  dispute_details TEXT,
  dispute_evidence TEXT,
  dispute_resolution TEXT,
  refund_cents INTEGER NOT NULL CHECK (refund_cents > 0),
  seller_cents INTEGER,
  stripe_transfer_id TEXT,
  stripe_refund_id TEXT UNIQUE,
  stripe_reversal_id TEXT UNIQUE,
  refund_started_at TIMESTAMPTZ,
  reversal_started_at TIMESTAMPTZ,
  refund_status TEXT NOT NULL DEFAULT 'not_started',
  recovery_status TEXT NOT NULL DEFAULT 'not_started',
  error TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS return_label_payments (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL REFERENCES order_returns(order_id),
  shipment_id TEXT NOT NULL,
  rate_id TEXT NOT NULL,
  rate JSONB NOT NULL,
  amount_cents INTEGER NOT NULL CHECK (amount_cents > 0),
  stripe_session_id TEXT UNIQUE,
  stripe_payment_intent_id TEXT,
  status TEXT NOT NULL DEFAULT 'quoted',
  shippo_transaction_id TEXT,
  label JSONB,
  error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS one_return_label_payment_per_order
  ON return_label_payments(order_id) WHERE status NOT IN ('expired', 'quote_expired');
CREATE TABLE IF NOT EXISTS return_quotes (
  shipment_id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL REFERENCES order_returns(order_id),
  rates JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS return_notification_outbox (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL REFERENCES orders(id),
  kind TEXT NOT NULL,
  sent_at TIMESTAMPTZ
);
`;
