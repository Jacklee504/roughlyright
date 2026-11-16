# Roughly Right

Daily estimation game ("Estimation" prototype) built to the contract in
`Daily_Estimation_Web_Game_GLM_Handoff.md`: one attempt per browser per
puzzle per mode, five rounds scored out of 500, UTC daily reset, a 30-minute
finish window, an unranked archive for missed dates, spoiler-free share links,
and editorial content import with validation.

## Quickstart

```sh
npm install
npm run db:migrate     # create schema (embedded Postgres, see Database below)
npm run db:seed        # import live content (fixtures only when no live content exists)
npm run dev            # http://localhost:3000
```

Open http://localhost:3000, go to **Estimation**, and play the day's puzzle.
The shipped library (`content/live/`) covers 60 consecutive daily puzzles —
300 mathematics-first prompts (64 defined conversions/exact constants, 180
Fermi calculations from 60 families, 56 target matches over 7 datasets),
dated 2026-11-16 through 2027-01-14. `content/fixtures/` holds synthetic
demo days used only when no live content exists.

## Scripts

| Script                   | What it does |
| ------------------------ | ------------ |
| `npm run dev`            | Next.js dev server |
| `npm run build`          | Production build |
| `npm run verify`         | Production build into `.next-verify` — safe to run while `next dev` is serving |
| `npm run typecheck`      | `tsc --noEmit` |
| `npm test`               | Unit tests (vitest: parser, scoring, autocorrect) **and** the integration suite (`tsx tests/integration.mts`, assert-based, fresh in-memory Postgres each run) |
| `npm run db:migrate`     | Apply versioned SQL migrations from `migrations/*.sql` |
| `npm run db:seed`        | Import editorial content — live library first; fixtures only when no live content exists (local demo) |
| `npm run content:publish`| **Production path**: imports approved live content only — rejects fixtures, requires `content/live/approvals.json` editor approval metadata, freezes datasets referenced by published puzzles |
| `npm run jobs:daily`     | Daily ops job: atomically reconciles `site_events` rollups from attempt ground truth and applies retention (12-month inactive-attempt purge, closed reports + old rollup rows deleted after 12 months) |
| `npx tsx scripts/triage.mts list` | Private content-report triage CLI (`list [--status …]`, `resolve <id>`, `dismiss <id>`) |
| `npx tsx scripts/verify-content.mts` | Re-validates every file in `content/live/` with the production validator + benchmark cross-checks |
| `npm run db:reset`       | Delete the local database and redo migrate + seed |

## Database

This prototype runs on **PGlite** (`@electric-sql/pglite`) — a real PostgreSQL
(WASM build) embedded in the Node process, so there is no server to install or
configure for local development. The SQL in `migrations/` and every service
query is plain Postgres dialect; pointing `DATABASE_PATH` at a hosted Postgres
instance later only requires swapping the client in `src/lib/db/client.ts`
(see `OPEN_QUESTIONS.md`).

- `DATABASE_PATH` — filesystem directory for the data files
  (default `./.data/pg`, ignored by git). Set `DATABASE_PATH=":memory:"` for a
  throwaway in-memory database (the integration suite does this itself).
- Runtime artifacts live only in `.data/` and `.next/`; never commit them.

## Environment variables

There are no required environment variables for local development. Optional:

| Variable        | Meaning | Example value |
| --------------- | ------- | ------------- |
| `DATABASE_PATH` | PGlite data directory, or `:memory:` for a RAM-only database | `./.data/pg` |
| `DATABASE_URL`  | Hosted PostgreSQL connection string; when set, it takes precedence over PGlite (production/Netlify mode) | `postgresql://…-pooler…/neondb?sslmode=require` |

No `.env` file is needed for local play; nothing here reads secrets.
(Never put secrets in this project or in chat — hosted credentials live in
Netlify's environment settings.)

## Deploying

See `DEPLOY.md` for the full Netlify + hosted-Postgres walkthrough (Neon
recommended, ~5 minutes of browser setup plus one migrate/seed run).
`netlify.toml` pins Node 22 and the official Next runtime; `.github/workflows/ci.yml`
runs typecheck + the full test suite on every push.

## How the game works (contract summary)

- **Identity** — an opaque server-issued guest token in an HttpOnly,
  `SameSite=Lax` cookie (`rr_guest`, set by `src/middleware.ts`). No accounts.
- **Daily loop** — five rounds in the fixed mix
  `direct_fact, calculation, calculation, calculation, target_match`
  (a second direct fact is allowed only in the final slot). Each round is
  opened, resolved (scored or passed), then advanced; request IDs make every
  submission idempotent, so double-clicks and reloads are safe.
- **Scoring** — continuous points: `round(100 × min(guess,answer)/max(guess,answer))`,
  so being 2× high loses exactly as much as being 2× low (reciprocal errors
  score equally). Marks are descriptive: Exact / Close / In range / Far, plus
  Pass (0 points). Total is out of 500. Verified against every worked example
  in the handoff (`tests/scoring.test.ts`).
- **Number input** — a strict parser accepts plain digits, scientific
  notation, thousands separators, and common suffixes (`k`, `m`, `bn`, …),
  with distinct rules for counted things (whole numbers only) vs measured
  quantities. Rejections always explain themselves
  (`tests/parser.test.ts`).
- **Autocorrect** — rejected guesses get an *offered* correction, never a
  silent rewrite: lookalike letters (`9oo` → 900), wrapping prose
  ("about 900"), currency symbols, appended units (`900kg`), broken grouping
  (`1.234.567`, `3,50,000`), doubled decimal points, and the decimal-comma
  ambiguity (`5,00` → 5 measured / 500 counted). Target-match typing gets
  fuzzy typo matching ("harbr lights" → Harbor Lights) in the after-lock
  resolve flow; live autocomplete is deliberately prefix-only. See
  `src/lib/domain/autocorrect.ts` and `tests/autocorrect.test.ts`.
- **Finish window** — a daily attempt may start only on its own UTC date and
  may finish up to 30 minutes past midnight (00:30 UTC next day); late
  completions still credit the original day for streaks. Runs still open past
  that freeze as incomplete (ranked) and the date becomes replayable unranked
  in the archive.
- **Archive** — every released date is replayable free of charge; archive
  attempts never affect streaks or daily stats.
- **Hints** — server-supplied text/figure only (the shipped library uses no
  image hints); opening one never changes the score. Target-match rounds have
  no hints.
- **Privacy** — no accounts and no tracking: a functional guest cookie plus
  your own play data. `/privacy` explains what is stored and offers a JSON
  export and a typed-confirmation deletion of everything linked to the
  browser's guest.
- **Sharing** — a completed attempt gets an unguessable token whose payload
  contains only game, puzzle number, date, total, and the five marks — no
  prompts, answers, or solution steps. Comparison marks unlock only for a
  viewer who has completed the same puzzle. Links can be revoked.
- **Safety** — same-origin checks and coarse per-guest rate limits on every
  mutating endpoint; malformed IDs are rejected at the door; expiry is applied
  lazily inside the same transaction that reads an attempt.

## Adding content

1. The shipped launch library lives in `content/live/` (one JSON file per
   dataset and per daily, plus `approvals.json` for production release
   metadata). It was generated by `scripts/gen-library.mts` from the modular
   sources in `scripts/lib/content-gen/` — regenerate with
   `npx tsx scripts/gen-library.mts`.
2. Validate before publishing anything: `npx tsx scripts/verify-content.mts`
   re-validates every file with the production validator and cross-checks
   calculation benchmarks. The importer refuses invalid content: slot mix,
   numeric ranges and supported units, declared sources and assumptions,
   hint requirements, target-set size (≥5 entries), a best entry worth ≥90
   points, distractor quality, benchmark recomputation for calculations, and
   editorial rounding (`roundTo`).
3. Local preview: `npm run db:seed` imports the live library (fixtures only
   when no live content exists — fixtures never displace live dailies).
4. Production publish: fill in `content/live/approvals.json` (one named
   editor + review date per puzzle date), then run `npm run content:publish`
   with `DATABASE_URL` set. The production path rejects fixture content and
   refuses puzzles without recorded approval.
5. Published content is immutable: re-importing an unchanged puzzle is a
   no-op, datasets referenced by published puzzles are frozen, and changed
   prompts create new prompt revisions rather than rewriting history.
   Display numbers are assigned once at first publication and never
   renumbered.

## Project layout

```
migrations/          versioned SQL schema (0001 init, 0002 premium [superseded],
                     0003 drop premium)
content/live/        launch library: 7 datasets + 60 dailies + approvals.json (empty)
content/fixtures/    synthetic demo puzzles (local only; never production)
scripts/lib/content-gen/  modular library sources (directs, datasets, calc families)
scripts/             gen-library, verify-content, publish-content, seed,
                     jobs-daily, triage, migrate
src/lib/domain/      decimal/scoring/parser/autocorrect/calendar/text (pure, no I/O)
src/lib/content/     editorial types, validation, importer
src/lib/service/     attempts, puzzles, stats, share, reports, status, privacy
src/lib/db/          PGlite/hosted-Postgres dual-mode client, migrations runner
src/app/api/         estimation endpoints + /api/privacy (export, delete)
src/app/             game pages, archive, /privacy, result pages
src/middleware.ts    guest cookie issuance
tests/               vitest unit tests + tsx integration suite
```
