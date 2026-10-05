# Transaction recovery

Schema 39 adds durable outbound label attempts, atomic shipping/return notification events, and external refund reviews. The production build applies this additive migration after schemas 36–38. No existing order or listing state is rewritten by migration.

## Outbound labels

Shipping rates must come from a server-stored quote for the order, less than 30 minutes old. A paid purchase is recorded before calling Shippo. Concurrent requests share a lease; a timeout or crash cannot cause an automatic repurchase.

Use **Admin → Payment processing** (`/admin/payments`) to recover an incomplete purchase. Find the existing Shippo transaction with metadata `outbound-label:<order ID>` and submit its transaction ID. Recovery verifies the metadata and successful provider result. If the provider response was already saved, it is reused. Recovery never buys a label. If the order was refunded while the label was being created, fulfillment stays blocked; support must handle voiding/refunding the unused label with the carrier.

## Refunds

The Stripe destination at `https://www.tailorgraph.com/api/stripe/webhook` must retain its existing checkout/payment events and subscribe to `charge.refunded`, `refund.created`, `refund.updated`, and `refund.failed`.

Return refund events refresh Stripe's current refund state, including failures reported after initial success. They never silently issue a replacement refund. A failed refund puts the order into support review and creates buyer, seller, and administrator notices.

Refunds without a recognized TailorGraph return record are matched by PaymentIntent. Full refunds mark associated orders refunded; partial, pending, or failed external refunds put them on hold. Duplicate events do not create duplicate notices. Refunds that arrive before checkout completion retain the inventory reservation for review. The admin page records the charge and refund IDs, amounts, and current statuses. Verify seller transfer recovery in Stripe and the physical item's ownership/condition before resolving the case. External refunds never automatically restock an item or initiate a transfer reversal.

## Inventory, tracking, and notifications

Return closure changes inventory only on the first closure, and only when no other live/newer order owns that listing. Replaying a closed return cannot alter a later sale.

Tracking first matches the provider transaction, then an unambiguous carrier/tracking-number pair across both outbound and return shipments. The validated carrier delivery timestamp starts the seven-day return window. Replays cannot extend it. Missing or invalid timestamps do not create a new delivery date.

Shipping and return lifecycle events are inserted by database triggers in the same transaction as the state change. The five-minute email worker now also drains return notices into the durable email outbox. Queued purchase and shipment emails are suppressed after a refund or fulfillment hold.

## Verification and remaining boundaries

`npm test` includes the former audit reproductions plus concurrency, provider-timeout recovery, atomic event failure, refund replay, inventory ownership, and tracking identity tests. Provider calls are mocked; the tests do not charge cards, buy labels, or send real email.

Paid cancellations remain support-managed. Return reconciliation retains its existing daily fallback schedule; carrier and payment webhooks still process events immediately. This change does not add a new cancellation policy or change that schedule. The owner is checking the Stripe event subscription in the dashboard.
