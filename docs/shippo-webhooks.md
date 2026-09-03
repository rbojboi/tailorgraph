# Shippo Webhooks

TailorGraph verifies Shippo webhook requests before updating outbound or return tracking.

## Required Vercel Environment Variable

Set this in Vercel for Production and Preview:

```bash
SHIPPO_WEBHOOK_SECRET=<a long random secret>
```

## Shippo Endpoint URL

Shippo's dashboard can use the shared secret as a webhook URL token:

```text
https://www.tailorgraph.com/api/shippo/webhook?token=<same long random secret>
```

If Shippo sends a `Shippo-Signature` header, TailorGraph also accepts HMAC verification with the same secret. Requests without either a valid signature or matching shared secret are rejected before any order state is changed.
