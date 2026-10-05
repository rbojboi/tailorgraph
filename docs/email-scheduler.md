# Production email scheduler

QStash calls POST https://www.tailorgraph.com/api/cron/email every five minutes.
This preserves the existing offer authorization recovery, commerce payment recovery,
notification generation, digest flushing and email outbox delivery. Existing
database locks, event keys and provider idempotency keys make retries safe.

Configure the Upstash integration for Production only. It supplies QSTASH_TOKEN,
QSTASH_URL, QSTASH_CURRENT_SIGNING_KEY and QSTASH_NEXT_SIGNING_KEY as sensitive
environment variables. Redeploy after connecting or rotating keys. Both current
and next keys are accepted. Requests verify the signed canonical destination,
timestamps and exact body. Do not add a bearer token to QStash requests.

Create these schedules in the Upstash console after deployment:

| Destination | UTC cron | Method | Body | Retries | Timeout |
| --- | --- | --- | --- | --- | --- |
| https://www.tailorgraph.com/api/cron/email | */5 * * * * | POST | {} | 2 | 70s |
| https://www.tailorgraph.com/api/cron/email-health | 2-59/10 * * * * | POST | {} | 2 | 70s |

Use application/json. This is 432 scheduled deliveries/day before retries, below
the 500/day allowance shown during Vercel Marketplace installation (the Upstash
console currently displays 1,000/day). Keep the conservative schedule unless the
actual allowance is confirmed. Free service does not include an uptime SLA.

The health check alerts ADMIN_EMAILS using the configured support sender directly
through Resend if no worker success is recorded within ten minutes, or if database
health cannot be read. It does not depend on the outbox. Provider idempotency limits
alerts to one per incident, recipient and UTC day. A failed alert returns 503 so
QStash retries. A stale result with an accepted alert returns 200. Detection takes
about 10–20 minutes. These alerts report worker availability, not individual
permanently failed emails; use /admin/emails for delivery failures.

Both schedules share QStash and Vercel, so a provider-wide outage needs an
independent external uptime/heartbeat monitor. Inspect QStash Logs and DLQ for
exhausted retries and check /admin/emails for the last successful worker run.

Cutover: retain the GitHub schedule until at least one automatic QStash delivery
has succeeded, then remove its schedule trigger. Retain workflow_dispatch and
GitHub OIDC authorization as a manual recovery path. Never re-enable both timers
as a permanent configuration. To roll back, pause the QStash worker schedule and
restore the GitHub schedule (previous cron: 2-57/5 * * * *).

