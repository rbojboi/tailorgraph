export const EMAIL_OUTBOX_SCHEMA = `
  CREATE TABLE IF NOT EXISTS email_outbox (
    event_key TEXT PRIMARY KEY,
    payload JSONB,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','sending','sent','skipped','failed')),
    attempts INTEGER NOT NULL DEFAULT 0,
    available_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    first_attempt_at TIMESTAMPTZ,
    lease_token TEXT,
    leased_until TIMESTAMPTZ,
    last_error TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMPTZ
  );
  CREATE INDEX IF NOT EXISTS email_outbox_pending_idx ON email_outbox(available_at)
    WHERE status IN ('pending','sending');
`;

