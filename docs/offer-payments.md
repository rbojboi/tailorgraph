# Offer payments

New offers are binding at their explicitly authorized item and shipping total. They are held as buyer-only drafts until Stripe Checkout completes card setup. No charge occurs during initial submission. Consent records include the exact text, amount, shipping address, seller destination account, buyer, offer revision and timestamp. Card details stay in Stripe.

Seller acceptance atomically reserves inventory and creates a pending order. A Stripe PaymentIntent is created without confirmation, its ID is saved, and only then is it confirmed off-session. A seller counter invalidates the previous authorization. The buyer reviews and authorizes the changed amount before accepting or sending another counteroffer. Accepting a seller counter starts payment after setup completes.

Only a verified successful payment with the expected amount, currency, customer (for offers), payment metadata and seller transfer can mark the order processing, sell the listing, start shipping deadlines and queue confirmation mail. The existing 10% item commission and shipping allocation are preserved. PaymentIntent IDs are retained for the existing refund process. The shipping quote is frozen at buyer authorization; seller edits cannot increase it.

## Reservations and recovery

Ordinary Checkout uses the same inventory claims as automatic offers. Concurrent offers and Buy Now cannot create two payable purchases for one garment. Normal Checkout reserves inventory for approximately 30 minutes. After an accepted offer requires buyer action, the initial reservation lasts 24 hours. Opening recovery Checkout starts a new approximately 30-minute payment window, shown in the buyer's offers.

A declined card is not repeatedly charged. Recovery first persists its intention, verifies and cancels the original PaymentIntent, and then creates one idempotent hosted Checkout session. Bank verification or a different card can be completed there. Orders cannot be shipped or have a shipping label purchased through the shipping actions before payment is confirmed.

The signed Stripe webhook and existing authenticated GitHub Actions worker both reconcile durable records. The worker also checks incomplete setup sessions and recovers lost responses. Stable Stripe idempotency keys, persisted provider IDs and five-minute database leases protect retries. A lost Checkout creation response is recovered within 23 hours; after that, the payment enters support review instead of creating another potentially payable session. Stripe errors and timeouts never imply payment failure or authorize releasing inventory. A payment still processing with a bank keeps its reservation past the displayed deadline until Stripe resolves it.

Inventory is released only after known payable sessions and intents have been expired/canceled or verified unpaid. Expired legacy Checkout sessions are reconciled; ambiguous legacy pending orders without a session ID block new purchases and require manual review. Existing offers have `auto_charge=false` and retain the prior checkout flow because they lack consent for automatic payment.

## Email copy and senders

The existing TailorGraph layout and configured sender addresses remain in use. Payment notices are essential buyer/seller order emails; new offers and counters remain optional offer alerts. Stale processing/action notices are suppressed when the payment state changes.

- Buyer success: **Offer accepted — purchase confirmed**. “[Item]: $[offer]. Your payment of $[total], including shipping, is complete. The seller will prepare your order. You can follow shipping updates in My Purchases.” Button: **View purchase**.
- Seller success: **Offer accepted — payment received**. “[Item]: $[offer]. The buyer's payment of $[total], including shipping, is complete. Please prepare the order and ship by the deadline shown in your orders.” Button: **View order**.
- Pending: **Offer accepted — payment processing**. Buyer is told confirmation follows successful payment; seller is told to wait before shipping.
- Buyer action: **Offer accepted — complete your payment**. Explains bank verification or a different payment method and directs the buyer to the reservation deadline. Button: **Complete payment**.
- Seller waiting: **Offer accepted — awaiting buyer payment**. Explains that the buyer has been contacted and instructs the seller to wait for confirmation before shipping.

The exact rendered text lives in `lib/offer-email.ts`. Regular paid Checkout retains its existing purchase/sale templates, queued durably after fulfillment. No accepted-offer success email says payment is still required; that language applies only to legacy offers.

## Operations and rollout

The production build applies additive schema 38 after schemas 36 and 37, before application promotion. Preview builds never migrate the production database. No new secret is needed: existing Stripe, database, email and worker authentication settings are used. The existing `checkout.session.completed` webhook covers card setup and recovery. Also subscribe to `checkout.session.expired`, `payment_intent.succeeded`, `payment_intent.payment_failed` and `payment_intent.canceled` for prompt reconciliation; worker polling remains the fallback. GitHub scheduling is best effort, so recovery and email delivery may be delayed.

Admins can inspect `/admin/payments` for payment state, deadlines, Stripe IDs, order IDs, failures and ambiguous legacy checkouts. For `review` records, inspect Stripe using the persisted IDs, `metadata.paymentAttempt`, and the `commerce:<id>:checkout` or `commerce:<id>:recovery` idempotency key. Never clear a claim or start a replacement charge until any possible payment has been resolved. Verified successful receipts must finish the existing payment and order, not create a second purchase. Investigate storage/provider errors and resume the same record after correcting the cause. This page deliberately provides no unconditional recharge or release button.

Validation uses isolated PostgreSQL-compatible integration tests and mocked Stripe boundaries, including lost responses, duplicate processing, competing purchases, counteroffer consent, expired setup, declines, bank verification and uncertain payment retention. No live charge is part of automated validation. Before production promotion, exercise one complete purchase and one verification-required recovery using Stripe test mode against an isolated database.
