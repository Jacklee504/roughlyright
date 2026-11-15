# Open Questions & Deviations

Decisions made while implementing the handoff contract that either (a)
diverge from the document, (b) fill in details the document leaves open, or
(c) need a product/editorial call before launch. Grouped by who needs to
decide.

## A. Deviations from the handoff document

### A1. PGlite instead of a hosted PostgreSQL server
The handoff specifies PostgreSQL with versioned SQL migrations. No Postgres
server is installed in this environment, so the app runs on
`@electric-sql/pglite` (a genuine Postgres build compiled to WASM, embedded
in the Node process). Everything above the driver — migrations, SQL, types,
transaction logic — is plain Postgres and unchanged; only `src/lib/db/client.ts`
would be swapped to talk to a hosted server (e.g. via `pg` or a serverless
driver). Consequences worth knowing:

- Single connection per process, so services are transaction-aware
  (transaction-bound helpers take the client explicitly). A hosted pool with
  multiple connections runs the same code, but the code must stay
  transaction-clean; a lint/test rule against `q()` inside transactions would
  be a reasonable safeguard.
- Tests can't run the DB suite under vitest: PGlite's WASM aborts under
  vitest's module runner (`Aborted(). Build with -sASSERTIONS…`). The
  integration suite therefore runs under plain Node via `tsx`
  (`tests/integration.mts`, assert-based, in-memory database). Unit tests for
  pure logic stay in vitest. `npm test` runs both.
- Migration runner splits SQL files into single statements (PGlite's prepared
  queries reject multi-statement strings) and strips `--` comments first.
  If/when moving to a hosted server, the splitting can stay or go — it is
  harmless either way.

**Question:** is PGlite acceptable for local dev/tests long-term, and which
hosted Postgres should production target (affects connection-string config
only)?

### A2. `middleware.ts` must live in `src/`
The app uses the `src/` layout, and Next.js only picks up middleware from
`src/middleware.ts` in that case — a root-level file is silently ignored (the
guest cookie was never set until the file was moved). Documented here so the
placement isn't "corrected" back.

### A3. `site_events.detail` is NOT NULL via the primary key
The schema puts `detail` in the primary key, which implicitly makes it NOT
NULL; the share event originally tried to record `null` detail and failed.
Share events now use an empty string. If null-detail events ever matter, the
fix is a migration using a sentinel or splitting the PK.

### A4. Malformed ID hardening added
The handoff doesn't specify behaviour for malformed attempt/revision IDs;
untreated they reached Postgres and surfaced as raw 500s. All mutating
endpoints now validate UUID shape at the door and answer `400 bad_request`.
No behavioural risk, but it is an addition beyond the contract.

### A5. Test clock injection
The calendar/finish-window logic needs a controllable clock for tests
(`src/lib/domain/clock.ts`, `setClock()`). Production always uses the real
clock; the indirection is test-only. This is an implementation choice the
handoff didn't prescribe.

## B. Implemented decisions where the document was open-ended
(Reasonable defaults chosen — veto any of these.)

1. **Community percentile audience** — the recap percentile counts *completed
   daily attempts* on the same prompt revision with a scored outcome,
   requiring ≥50 others (`others < 50 → no percentile shown`). Alternatives:
   count unique guests (multiple attempts per guest can't exist for daily,
   so this equals guests today), include archive attempts, or show the
   percentile from a lower threshold. What threshold and audience is desired?
2. **Rate limits** — coarse per-guest limits (resolve 60/min, share 20/min,
   report 5/hour, etc.), in-memory only. They reset on process restart and
   are per-instance. Fine for a prototype; a hosted multi-instance deploy
   needs a shared limiter. Are specific numbers desired?
3. **`state` and `hint` endpoints are POST** — kept GETs out to stay
   consistent with the same-origin discipline used by the mutators. If you
   prefer semantic GETs for reads, they can be split, at the cost of a second
   guard style.
4. **Suggest endpoint** — autocomplete starts after 3 normalised characters,
   returns up to 8 labels sorted alphabetically, never values. No relevance
   ranking against the target (deliberately answer-neutral). OK as is?
5. **Co-best target matches** — entries tied on the maximum `ratioClose` are
   all shown as "closest" (capped at 3 + a "more" count). The handoff
   mentions ties without prescribing presentation.
6. **Display-number renumbering** — import renumbers `display_number` for all
   released puzzles of a game so the count always starts at the earliest
   puzzle, regardless of insertion order. Confirm this is the intent rather
   than author-assigned numbers.
7. **Expiry replay UX** — an expired daily attempt freezes as incomplete
   (ranked, 0-500 partial), and the archive offers an unranked replay of that
   date the same day. The home page then treats the day as done for streak
   purposes (it counts only completed ranked runs).

## C. Gaps that need a product/editorial decision before launch

1. **Unit-reduction validation is partial.** The importer checks that
   calculation inputs have declared units and assumptions, and recomputes the
   benchmark, but it does not fully verify dimensional consistency (e.g. that
   "kg/loaf ÷ kg flour" reduces to loaves). Editorial review must own unit
   sanity until a stronger check is built.
2. **Fixture content is synthetic.** Every number, source title and URL in
   `content/fixtures/` is invented for demonstration. Real launches need real
   sourced content — the validator enforces *that sources are declared*, not
   that they are correct.
3. **Hint images** are placeholder SVGs (`public/hint-images/`); the data
   model and the image/text fallback are implemented, but no real artwork
   exists. Who produces hint artwork, and under what rights model (the
   importer requires credit + rights strings)?
4. **Report triage** — content reports are stored (private, rate-limited)
   but there is no operator UI or export. Where should reports land (email,
   spreadsheet, admin page)?
5. **Browser E2E automation deferred.** The API loop is covered by the
   integration suite and was smoke-tested through the real HTTP surface
   (pages, cookies, full five-round play, share, report), but no Playwright/
   browser-driver suite exists. Do you want one, and against which browser
   environment?
6. **Guest identity is device-bound.** No accounts means streaks and scores
   do not survive a cleared cookie or a new browser. The handoff describes
   cookie identity; is a lightweight cross-device sync (e.g. "name +
   passcode") wanted later, and if so does it change the one-attempt-per-guest
   rule?
7. **Percentile wording** — the recap shows "you did better than N% of
   players" semantics (floor of the share of *other* guesses with a larger
   error factor). Confirm the exact wording is acceptable.

## D. Known limitations (accepted for the prototype)

- Rate limiting and event aggregation are in-memory; they do not survive
  restarts and do not aggregate across instances.
- No full-text search or filtering in the archive beyond the date index.
- The parser supports the handoff's grammar (units suffixes, grouping,
  scientific notation, fractions of counted things rejected) but not
  spelled-out English numbers ("eight hundred").
- `next build`/production deployment has not been exercised here (no hosting
  target yet); dev-mode behaviour is verified.
