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

## One-time: migrate + seed the production database

From the project root, with your connection string in place:

```sh
export DATABASE_URL="postgresql://…-pooler…/neondb?sslmode=require"
npm run db:migrate   # applies migrations/*.sql
npm run db:seed      # imports content/fixtures (and content/live if present)
```

Both scripts are idempotent — re-running is always safe.

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
| Guest cookie | `Secure` off (http) | `Secure` on (https) |
| Rate limits | in-memory per process | in-memory per function instance (approximate) |

## Updating content after launch

Add files to `content/live/`, then re-run `npm run db:seed` with
`DATABASE_URL` set locally (or from any machine with the env var). Published
puzzles are immutable — changed prompts create new revisions; new dates
import as new rows. Nothing needs to change on Netlify; the running site
picks content up from the database.

## If the site errors with "relation … does not exist"

The database hasn't been migrated. Re-run `npm run db:migrate` with
`DATABASE_URL` set, then redeploy (a redeploy isn't strictly required —
the next function instance picks up the new schema — but it's the
deterministic way to confirm).
