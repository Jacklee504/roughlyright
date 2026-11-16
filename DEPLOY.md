# Deploying to Netlify

The app ships with a dual-mode database client, so the same code runs
embedded-Postgres locally and hosted-Postgres in production.

## One-time: create the database

1. Create a project at [neon.tech](https://neon.tech) (or any hosted
   Postgres). Copy the **pooled** connection string (Neon marks it
   "pooled"; it contains `-pooler` in the host) — serverless functions
   should not hold dedicated connections.
2. Keep the string out of chat/repo. It goes in two places only: your local
   shell for seeding, and Netlify's environment settings.

## One-time: migrate + publish the production database

From the project root, with your connection string in place:

```sh
export DATABASE_URL="postgresql://…-pooler…/neondb?sslmode=require"
npm run db:migrate        # applies migrations/*.sql
npm run content:publish   # production content import (strict)
```

`content:publish` is the **production content path** (never use `db:seed`
against production): it rejects synthetic fixture material, requires
`content/live/approvals.json` recording a named editor and review date for
every puzzle date being published, and refuses to mutate datasets that
published puzzles already reference. Before publishing, validate the
content directory with `npx tsx scripts/verify-content.mts`.

Both scripts are idempotent — re-running is always safe.

## Scheduled jobs

`npm run jobs:daily` performs the daily operations work: it atomically
reconciles the anonymous `site_events` counters from attempt ground truth,
rolls up the invalid-input funnel reasons (Q48), applies the retention
policy (attempts belonging to guests inactive for 12 months are purged,
closed content reports and rollup rows older than 12 months are deleted,
granular invalid-input events after 90 days, expired rate-limit counters),
and alerts if today's live daily puzzle is missing by exiting with code 2
(Q50) — wire that non-zero exit into your scheduler's alerting. Schedule it
once a day (e.g. Netlify scheduled function, cron) with the same
`DATABASE_URL`. It is restart-safe and idempotent.

`npm run metrics` prints the Q45 KPI report (D7 return among first-time
finishers primary; D1, completion, share and correction rates secondary;
explicitly directional below 100 qualified first-time finishers). Run it
whenever you want a read — it is read-only.

## Netlify site setup

1. **Add new site → Import an existing project → GitHub → `Jacklee504/roughlyright`.**
   Netlify detects Next.js via `netlify.toml` (build: `npm run build`, the
   official Next runtime handles routing and serverless packaging).
2. **Site configuration → Environment variables → add:**
   - `DATABASE_URL` = the pooled connection string from step 1
   (optional) `NODE_VERSION` — already pinned to `22` in `netlify.toml`.
3. Deploy. HTTPS is automatic; the guest cookie flips to `Secure`
   automatically in production builds.

## What runs where

| Concern | Local dev | Netlify |
| --- | --- | --- |
| Database | PGlite at `./.data/pg` | hosted Postgres via `DATABASE_URL` |
| Migrations | automatic on boot | `npm run db:migrate` (manual, idempotent) |
| Content | `npm run db:seed` (live library; fixtures only if none) | `npm run content:publish` (strict, approval-gated) |
| Guest cookie | `Secure` off (http) | `Secure` on (https) |
| Rate limits | in-memory per process | shared `rate_limit_hits` counters in hosted Postgres (Q26/Q49); fail-open to per-instance memory on limiter errors |
| Daily job | `npm run jobs:daily` (optional) | scheduled daily with `DATABASE_URL` |

## Updating content after launch

Add files under `content/live/` (with approval metadata for the new dates),
verify with `npx tsx scripts/verify-content.mts`, then re-run
`npm run content:publish` with `DATABASE_URL` set locally. Published puzzles
are immutable — re-importing an unchanged puzzle is a no-op, datasets
referenced by published puzzles are frozen, and changed prompts create new
revisions rather than rewriting history. Display numbers are assigned once
at first publication and never renumbered, so shared result links stay
stable. Nothing needs to change on Netlify; the running site picks content
up from the database.

## Content reports

Player-submitted content-error reports accumulate privately. Triage them
with the operator CLI (`npx tsx scripts/triage.mts list|resolve|dismiss`)
against the production `DATABASE_URL`; closed reports are deleted by the
daily job after 12 months.

## If the site errors with "relation … does not exist"

The database hasn't been migrated. Re-run `npm run db:migrate` with
`DATABASE_URL` set, then redeploy (a redeploy isn't strictly required —
the next function instance picks up the new schema — but it's the
deterministic way to confirm).
