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
npm run db:seed        # import fixture puzzles + demo target dataset
npm run dev            # http://localhost:3000
```

Open http://localhost:3000, go to **Estimation**, and play the day's puzzle.
The fixtures cover the four days up to the seed date, so today's puzzle is
always available right after seeding (display numbers count from the earliest
puzzle).

## Scripts

| Script              | What it does |
| ------------------- | ------------ |
| `npm run dev`       | Next.js dev server |
| `npm run build`     | Production build |
| `npm run verify`    | Production build into `.next-verify` — safe to run while `next dev` is serving |
| `npm run typecheck` | `tsc --noEmit` |
| `npm test`          | Unit tests (vitest: parser, scoring, autocorrect) **and** the integration suite (`tsx tests/integration.mts`, assert-based, fresh in-memory Postgres each run) |
| `npm run db:migrate`| Apply versioned SQL migrations from `migrations/*.sql` |
| `npm run db:seed`   | Import editorial content from `content/fixtures/` and `content/live/` (same validator for both) |
| `npm run db:reset`  | Delete the local database and redo migrate + seed |

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
- **Scoring** — error factor `ratioClose = min(guess,answer)/max(guess,answer)`
  drives the mark: Exact / Close / In range / Far, plus Pass (0 points).
  Total is out of 500. Verified against every worked example in the handoff
  (`tests/scoring.test.ts`).
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
  fuzzy typo matching ("harbr lights" → Harbor Lights) in both the resolve
  flow and the autocomplete fallback. See `src/lib/domain/autocorrect.ts`
  and `tests/autocorrect.test.ts`.
- **Finish window** — a daily attempt may start only on its own UTC date and
  may finish up to 30 minutes past midnight (00:30 UTC next day); late
  completions still credit the original day for streaks. Runs still open past
  that freeze as incomplete (ranked) and the date becomes replayable unranked
  in the archive.
- **Archive** — older released dates are replayable at any time; archive
  attempts never affect streaks or daily stats.
- **Hints** — server-supplied text/figure/image; opening one never changes the
  score. Target-match rounds have no hints.
- **Sharing** — a completed attempt gets an unguessable token whose payload
  contains only game, puzzle number, date, total, and the five marks — no
  prompts, answers, or solution steps. Comparison marks unlock only for a
  viewer who has completed the same puzzle. Links can be revoked.
- **Safety** — same-origin checks and coarse per-guest rate limits on every
  mutating endpoint; malformed IDs are rejected at the door; expiry is applied
  lazily inside the same transaction that reads an attempt.

## Adding content

1. Copy a fixture file as a template (`content/fixtures/day1.json` for a
   puzzle, `films-fixture.json` for a target dataset).
2. Live content goes in `content/live/` (created on demand by the importer).
   Fixture files carry `"quality": "fixture"` and are demonstration data only
   — all numbers are synthetic.
3. Dates may be authored as absolute `date` strings or as `dayOffset`
   relative to the seed date (fixtures use offsets).
4. Run `npm run db:seed` (or `npm run db:reset` for a clean slate). The
   importer validates everything and refuses invalid content:
   slot mix, numeric ranges and supported units, declared sources and
   assumptions, hint requirements, target-set size (≥5 entries), a best
   entry worth ≥90 points, distractor quality, benchmark recomputation for
   calculations, and editorial rounding (`roundTo`).
5. Published (non-fixture) content is immutable: re-importing an unchanged
   puzzle is a no-op, and changed prompts create new prompt revisions rather
   than rewriting history.

## Project layout

```
migrations/          versioned SQL schema (single migration today)
content/fixtures/    demo puzzles + demo target dataset
src/lib/domain/      decimal/scoring/parser/autocorrect/calendar/text (pure, no I/O)
src/lib/content/     editorial types, validation, importer
src/lib/service/     attempts, puzzles, stats, share, reports, status
src/lib/db/          PGlite client, migrations runner
src/app/api/estimation/  status, start, resolve, advance, state, hint,
                     suggest, share, report endpoints
src/app/estimation/  game page, archive, share result page
src/middleware.ts    guest cookie issuance
tests/               vitest unit tests + tsx integration suite
```
