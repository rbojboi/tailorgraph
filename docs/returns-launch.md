# Launch returns: rollout and acceptance

## Policy implemented

- Sellers choose returns allowed or no returns. The order's purchase-time policy is authoritative.
- Buyer requests within 7 calendar days of original delivery. Eligible requests are approved immediately.
- Buyer purchases a tracked Shippo return label in a separate Stripe Checkout and hands the parcel to the carrier within 5 calendar days of approval.
- A verified Shippo TRANSIT or DELIVERED scan within that window triggers one refund of the full item subtotal. Label creation alone never triggers it. Original outbound shipping and the separate return-label charge are excluded.
- TailorGraph refunds its item fee: the buyer receives the entire item subtotal and only the original seller share is recovered from the Connect transfer. There is no partial-item-refund input.
- Seller can submit evidence of a returned-item problem within 48 hours of carrier delivery. Admin reviews it; no automatic recharge of the buyer or seller reimbursement.
- The listing stays sold during transit/inspection. Closing an undisputed return moves it to draft for seller review, not straight back onto the marketplace. An upheld seller dispute archives it.

## Money flow

The existing checkout uses destination charges with `transfer_data.amount` (seller share of item subtotal), not Stripe application-fee objects. The return code refunds item subtotal and separately reverses the exact seller allocation from the original transfer. It deliberately does not use proportional `reverse_transfer`, which would include the nonrefundable shipping denominator. Multi-item allocations are stable and reconcile to the actual original transfer, including cents rounding.

Example: $100 item, $10 outbound shipping, $90 original seller transfer. Buyer gets $100 back; seller transfer reversal is $90; TailorGraph gives up its $10 fee. A separately purchased $8 return label remains paid. Stripe processing costs are not deducted from the buyer's item refund.

Buyer refund and seller recovery are separate operations. TailorGraph must maintain enough Stripe balance to fund refunds, including when seller recovery fails. A pending refund is shown as pending; an order is marked refunded only on Stripe success. Failed or uncertain operations require review, never an unbounded blind retry.

References: [Stripe destination charges](https://docs.stripe.com/connect/destination-charges), [transfer reversals](https://docs.stripe.com/connect/separate-charges-and-transfers), [Shippo tracking](https://docs.goshippo.com/shippoapi/public-api/tracking-status/gettrack).

## Deployment sequence

1. Use an isolated preview database, Stripe test-mode keys/Connect accounts, and Shippo test token first. Preview must not point to production financial credentials or production data. Use Node 24 for the test runner.
2. Back up the target database. Run `npm ci`, then `npm run db:migrate` with `DATABASE_URL` supplied securely by the environment. This applies schema version 35 and creates return records, label payments, quote storage, workflow locks and a notification outbox. The migration is additive and tested twice against a Postgres-compatible PGlite engine; hosted Postgres execution still needs verification. Do not print credentials or commit `.env` files.
3. Configure `NEXT_PUBLIC_APP_URL`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `SHIPPO_API_TOKEN`, `SHIPPO_WEBHOOK_SECRET`, `RESEND_API_KEY`, verified email sender settings, `ADMIN_EMAILS`, and a strong `CRON_SECRET`. Keep preview and production values isolated. Existing auth/session settings remain required.
4. Stripe endpoint `/api/stripe/webhook`: subscribe to `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `checkout.session.async_payment_failed`, `checkout.session.expired`, `refund.created`, `refund.updated`, and `refund.failed`. Verify signed deliveries reach the correct environment.
5. Shippo endpoint `/api/shippo/webhook`: enable `track_updated` and `transaction_updated` with the authentication supported by `lib/shippo-webhook-auth.ts`. Tracking objects identify their transaction via `transaction`, not their own `object_id`. Return money movement always re-fetches authoritative tracking from Shippo.
6. Deploy the application only after migration. `vercel.json` schedules authenticated `/api/cron/returns` once daily at 08:00 UTC (Hobby-compatible). Webhooks perform immediate processing; cron is recovery for missed events, pending refunds, inspection closure and email retries. Monitor non-200 cron/webhook responses. Higher volume requires more frequent reconciliation on a suitable plan.
7. Verify `/returns`, buyer and seller return pages, `/admin/returns`, ownership checks, and the acceptance cases below before enabling live use. Set alerts for refund, recovery and label failures.

## TAI-7 acceptance checklist

Automated coverage uses real schema/query execution in PGlite with mocked Stripe/Shippo SDKs. It is not a live-provider acceptance test.

- [ ] Preview: seller Connect onboarding, real listing/media, buyer checkout, expected fee and transfer.
- [ ] Original delivery update sets delivery eligibility. No-return listing refuses standard returns; changing a listing later does not change existing orders.
- [ ] Buyer starts return within the window, gets approval email and immutable shipping deadline.
- [ ] Return label checkout charges exactly the server-quoted USD amount. Unpaid/expired sessions never purchase a label. Payment success buys exactly one label and sends its notification.
- [ ] Printing a label produces no item refund. First authentic carrier acceptance produces the full item refund and exact seller reversal, with outbound shipping retained.
- [ ] Replay duplicate/out-of-order Stripe and Shippo events. No second refund, reversal, label purchase, or reopened refunded order.
- [ ] Multi-item checkout: return one item then the other. Totals reconcile and unrelated orders remain unchanged.
- [ ] Pending/failed refund and insufficient seller balance remain visible; successful buyer refund is not undone or duplicated.
- [ ] Carrier delivery starts 48-hour inspection. Seller can submit evidence; admin can record an upheld/declined decision without charging the buyer.
- [ ] Undisputed closure returns the listing to draft. A disputed return does not automatically relist.
- [ ] Missing webhook and email outage recover through reconciliation/outbox; unauthenticated cron/webhooks and unauthorized users are rejected.
- [ ] Confirm existing outbound SMS behavior with an opted-in test buyer; new return notifications are email, not additional SMS subscriptions.
- [ ] After preview sign-off, a human executes the explicitly budgeted low-dollar production purchase/return and reconciles actual Stripe balances, Shippo tracking/labels and received notifications. Do not fabricate a bank chargeback in production; test bank-dispute handling in Stripe test mode.

## Operator recovery

`/admin/returns` shows refund/reversal IDs, provider errors, label status and seller evidence. Reconcile fetches current provider state; it cannot set arbitrary refund amounts.

- An ambiguous Shippo purchase is not retried. Find the successful transaction in Shippo using `return-label:<payment ID>` metadata and recover it with its transaction ID. The server verifies that metadata and success status. If no label was purchased, confirm the failure and refund the separate label payment in Stripe through an authorized operator; database reconciliation/new-label issuance requires support engineering. Never ask the buyer to pay again blindly.
- A lost Stripe response is recovered by stored IDs or return metadata. After the conservative 23-hour safety cutoff, unknown outcomes stop for manual reconciliation. Do not clear timestamps or IDs to force a retry. Explicitly failed/canceled refunds also require operator review.
- If seller recovery fails, fund/resolve the Connect balance problem, inspect original transfer reversals, and reconcile. TailorGraph bears the interim shortfall. Record separately authorized seller compensation in dispute review notes; recording a decision does not move money.
- Late returns, missing acceptance history, pre-existing legacy labels, active bank disputes or mismatched payment allocations are support cases. Do not bypass checks by manually changing order status to refunded.
- Rollback: leave additive schema intact. Do not roll back to the old status-only refund action while real returns are active; coordinate disabling entry points and continue reconciling existing records.

## Verification recorded during implementation

- Full automated suite: 72 passing tests (including 15 return integration tests).
- Typecheck, lint and production build checked locally; public policy page rendered and admin access redirected unauthenticated users to login.
- No live Stripe charges/refunds, Shippo label purchases, hosted database migration or production deployment were performed during implementation.
