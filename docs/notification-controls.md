# Notification operations

The existing GitHub Actions email worker now processes durable listing/offer events, shipping reminders, optional digests, the sending outbox, and provider delivery status. Its schedule is best effort. No additional Vercel cron or paid service is required.

## Delivery dashboard

Admins can open `/admin/emails` from the admin dashboard. It shows recent delivery metadata, provider IDs, failures, suppression state, and the last completed worker run. It does not display email bodies. `sent` means Resend accepted the request; `delivered` means the recipient's mail server accepted the email, not that the person read it.

Status polling checks up to ten recent provider receipts per run, spaced to respect rate limits. It revisits receipts for seven days. For prompt and later bounce/complaint events, optionally register `https://www.tailorgraph.com/api/resend/webhook` in Resend and set `RESEND_WEBHOOK_SECRET` to its signing secret. The endpoint validates Svix signatures against the raw request body. Sending and polling work without this optional webhook configuration.

Safe retries retain the original idempotency key and require an unacknowledged failed outbox item, fewer than ten attempts, and a first attempt less than 23 hours ago. Provider-acknowledged messages, expired idempotency windows, and suppressed recipients require manual provider review. Bounces and complaints suppress future sends to the affected address; support should resolve the address issue before manually lifting suppression.

## Optional preferences

Each optional category supports instant, daily, weekly, or off. Daily digests are eligible after 09:00 UTC and weekly digests after 09:00 UTC Monday. A worker run delivers due mail. Digests contain up to 30 updates per message and reuse the TailorGraph email style. Settings changes and recipient address changes are checked before sending. A changed frequency reschedules pending digest entries; switching to instant makes them eligible for the next worker run.

Optional emails include a signed category-specific unsubscribe link plus one-click unsubscribe headers. `EMAIL_UNSUBSCRIBE_SECRET` can override the existing `SESSION_SECRET`; no new secret is required on an installation that already has `SESSION_SECRET`. Rotating the signing secret invalidates previously sent links. Opening a link is a confirmation page; only POST changes preferences. Essential order, shipping, security, and support emails remain enabled.

## Offers and saved alerts

The receiving party can accept, decline, or counter a current offer. Each change has a revision to reject stale responses. New offers require explicit authorization of the item and shipping total through Stripe card setup before reaching the seller. Acceptance reserves the garment and charges automatically; counteroffers require renewed approval. Payment processing, success, and buyer-action notices are essential order mail and use the existing buyer/seller sender addresses. Legacy offers without recorded consent retain their seven-day checkout flow. See [offer-payments.md](./offer-payments.md) for recovery, inventory and rollout details.

Saved-item price drops go only to people who saved the item before the drop. Saved-search alerts use the same filters and fit matching as the marketplace, including repeated query parameters. Only new publications after a search was saved are eligible. Removed saves, sold listings, and price increases suppress stale pending alerts. Offer messages describe the event and direct the recipient to the current offer state.

## Shipping deadlines

Payment records a shipping deadline using the listing's processing time in business days (UTC, excluding weekends). Sellers receive one reminder during the final 24 hours and one after the deadline; buyers receive one delay notice. All are suppressed once shipment is recorded or the order is no longer paid/processing. Historical orders without a payment/deadline snapshot do not receive newly introduced reminders.

## Rollout

The production build runs additive schema migrations 37 and 38 after the existing version-36 migration, before application promotion. Preview builds do not migrate a shared production database. To exercise a preview against an isolated database, run the normal full database migration with runtime schema initialization enabled. An unmigrated production database should not serve this branch.

The delivery dashboard starts recording new activity after rollout; past Resend sends are not backfilled. Optional features remain opt-in according to existing account preferences. Fit Feed and seller performance summaries are still future features; their preference controls do not create those campaigns.

Validation includes the full application test suite, real SQL integration tests using PGlite, TypeScript, ESLint, and a production build. No real purchases, refunds, or customer email sends are needed for these tests.
