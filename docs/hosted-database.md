# Hosted Database Setup

TailorGraph now expects a hosted Postgres database through `DATABASE_URL`.

## Recommended providers

- Neon
- Supabase
- Railway Postgres
- AWS RDS / Aurora Postgres

Any standard Postgres connection string works.

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

## What the app stores

The app auto-creates these tables on first connection:

- `users`
- `buyer_profiles`
- `listings`
- `orders`

That means 1,000 or 100,000 listings live in Postgres as rows in the `listings` table, not in a local file or in application memory.

## Current behavior

- If `DATABASE_URL` is present, the app initializes the Postgres schema automatically.
- If `DATABASE_URL` is missing, the UI stays up but write actions are disabled and will redirect with setup guidance.
- Seed marketplace data is inserted only when the connected database is empty.

## Local run

```powershell
npm.cmd run dev
```

Then open [http://localhost:3000](http://localhost:3000).

## Next production step

After you provide a real hosted Postgres URL, the next upgrade should be file/image storage for listing photos plus a formal migration system.
