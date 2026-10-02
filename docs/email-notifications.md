# TailorGraph email notifications

The shared email design uses the site's ivory (#fcfcfa), warm neutral (#f5f1eb),
ink (#1c1712), rust (#b45b32), and deep rust (#6e3521). The existing TG logo,
Georgia editorial headings, Helvetica/Arial body text, inline CSS, and presentation
tables work without web fonts or JavaScript. Every existing email also has plain text.

## Events

| Event | Delivery | Preference |
| --- | --- | --- |
| Paid purchase | Buyer confirmation and seller sale email | Essential |
| Shipment / labels | Buyer shipment; seller shipping label; buyer return label | Essential |
| New offer | Seller dashboard link; explicitly not a paid order | Offers and Price Drops |
| Direct message | Queue for at least two minutes; skip if read before delivery | Messages |
| Followed seller listing | Existing publication trigger | Saved Sellers |
| Welcome | Existing signup trigger | Onboarding |
| Support request | Requester confirmation and admin alert | Essential |
| Verification / password reset | Immediate; each new token has its own key | Essential |
| Return workflow updates | Existing return outbox and sender, using the shared design | Essential |

Offer acceptance/countering has no implemented action in the current application.
Only actual new-offer events are connected here. Fit-match digests, saved-search
alerts, price drops, shipping reminders, message batching, and push notifications
remain a later release. This change does not activate those dormant preferences.

## Delivery and retries

Normal notifications are persisted in PostgreSQL email_outbox before attempting
Resend. Immediate delivery is attempted for all except delayed messages. Provider
outages leave pending jobs for the worker instead of failing the user's action.
A database enqueue failure still surfaces: silently losing the event is not success.
The outbox is written after the existing business operation, not in the same transaction;
Stripe webhook redelivery repairs interrupted purchase notifications, but a process
crash between a message/offer write and enqueue still needs event reconciliation.

The worker claims up to ten jobs using row locks and five-minute leases. Provider
idempotency keys and the existing notification_deliveries ledger protect retry
paths. The first payload wins on duplicate enqueue, so later listing edits cannot
change a retry. API acceptance is recorded, not proof of inbox delivery.
The sender preserves category From/Reply-To routing. Verification/reset URLs stay
out of the queue; their keys contain a token-URL hash rather than the token.

Transient errors retry with exponential backoff (one minute to one hour). Permanent
provider errors, ten attempts, or 23 hours since first attempt require operator
review. The 23-hour cutoff stays inside Resend's documented 24-hour idempotency
window. Do not blindly reset these rows: first inspect the provider record.
Accepted/skipped jobs erase their stored message payload; terminal failures retain
it for review. Error metadata excludes provider messages and recipient details.

At delivery, optional email preferences are checked again. An account that changed
its email or was removed does not receive queued optional content at its old address.
Already-read/deleted message threads are suppressed using their read timestamps.
Multiple unread messages are currently separate emails, not a digest.

## Preview without sending

```sh
npm ci
npm run email:preview
# http://127.0.0.1:3117
npm run email:render
# artifacts/email-preview (HTML and plain-text fixtures)
```

The preview uses sample data only and never calls a sending function. Browser
previews check layout, not rendering in every email client. Before launch, send
controlled test messages and check Gmail, Outlook, and mobile inboxes.

## Production configuration

1. Verify a sending domain in Resend, ideally mail.tailorgraph.com. Configure the
   DNS records Resend supplies. Use the existing support inbox for replies.
2. Set server-only RESEND_API_KEY and EMAIL_FROM. Existing EMAIL_FROM_* category
   overrides and EMAIL_REPLY_TO / EMAIL_REPLY_TO_SUPPORT remain supported.
3. Set NEXT_PUBLIC_APP_URL=https://www.tailorgraph.com so links and logos are absolute.
4. Set a strong CRON_SECRET and run npm run db:migrate before deploying this code
   (schema version 36 adds email_outbox).
5. The new /api/cron/email worker is scheduled every five minutes in vercel.json.
   This requires a Vercel plan supporting subdaily cron, or an equivalent external
   scheduler sending Authorization: Bearer <CRON_SECRET>. Do not downgrade it to a
   daily schedule: delayed messages and retry timing depend on frequent runs.
6. Check worker counts and pending/failed jobs. Missing email configuration returns
   HTTP 503 from the worker; it does not discard queued events.

Useful operational query (contains no email body):

```sql
SELECT event_key, status, attempts, available_at, last_error
FROM email_outbox
WHERE status IN ('pending', 'sending', 'failed')
ORDER BY created_at;
```

Production domain verification, secrets, migration, deployment, and live delivery
verification are separate from rendering/testing the code. No real emails are sent
by the automated tests. A provider webhook for delivered/bounced/complained status
and one-click unsubscribe for future discovery digests should be added before
launching marketing mail.

References: [Resend send API](https://resend.com/docs/api-reference/emails/send-email),
[idempotency](https://resend.com/docs/dashboard/emails/idempotency-keys),
[Vercel cron usage](https://vercel.com/docs/cron-jobs/usage-and-pricing).
