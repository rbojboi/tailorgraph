# Database Migrations

TailorGraph no longer runs schema DDL from normal production requests. Run migrations as an explicit deployment step before promoting code that needs schema changes.

## Run

```bash
npm run db:migrate
```

## Vercel

Run the migration with the same `DATABASE_URL` used by production before deploying or immediately before promoting a deployment. Runtime schema initialization stays disabled on Vercel unless `ALLOW_RUNTIME_SCHEMA_INIT=true` is set for a controlled one-off migration job.

Do not enable `ALLOW_RUNTIME_SCHEMA_INIT` as a permanent production environment variable.
