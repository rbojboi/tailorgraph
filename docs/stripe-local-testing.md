# Stripe Local Testing

Use this setup to test hosted Checkout and webhook fulfillment locally.

## Environment

Add these values to your local environment:

```env
DATABASE_URL="postgres://USER:PASSWORD@HOST:5432/DBNAME?sslmode=require"
NEXT_PUBLIC_APP_URL="http://localhost:3000"
SESSION_SECRET="replace-with-a-long-random-secret"
STRIPE_SECRET_KEY="sk_test_..."
STRIPE_WEBHOOK_SECRET="whsec_..."
ADMIN_EMAILS="your-admin-email@example.com"
```

## Start the app

```powershell
npm.cmd run dev
```

## Forward Stripe webhooks

Make sure the Stripe CLI is installed and logged in, then run:

```powershell
npm.cmd run stripe:listen
```

Copy the webhook signing secret that Stripe CLI prints and place it into `STRIPE_WEBHOOK_SECRET`.

The forwarding target is:

```text
http://localhost:3000/api/stripe/webhook
```

## Test checkout

1. Start the app.
2. Sign up for a buyer or buyer+seller account.
3. Add a listing to cart.
4. Use Stripe Checkout from the cart page.
5. Complete payment with Stripe test card `4242 4242 4242 4242`.

## Trigger test events manually

After webhook forwarding is running:

```powershell
npm.cmd run stripe:trigger:checkout
```

To simulate an async payment failure event:

```powershell
npm.cmd run stripe:trigger:async-fail
```

## Seller payouts

1. Sign in with a seller or buyer+seller account.
2. Open the seller dashboard.
3. Start Stripe Connect onboarding.
4. Return to the seller dashboard to inspect KYC and payout status fields.
