# Open Questions & Deviations

Decisions made while implementing the handoff contract that either (a)
diverge from the document, (b) fill in details the document leaves open, or
(c) need a product/editorial call before launch. Grouped by who needs to
decide.

---

## Question bank (needs owner input)

Grouped by area. Each is phrased so it can be answered in one line; "?"

items are lower priority.

### Gameplay & scoring

1. Is the 100/50/0-per-round scoring table final, or do we want a 4th band
   (e.g. "In range" worth 25) so near-misses feel less binary?
2. Should exact-zero-error guesses get a bonus (e.g. +10 "sniper" bonus), or
   is 100 the ceiling by design?
3. Is the finish window (00:30 UTC next day) the right length — should it be
   configurable per game?
4. What happens to a daily attempt started but abandoned at round 3 — is
   partial credit displayed anywhere, or is it invisible unless the player
   opens the state?
5. Should players see their per-round error factor (e.g. "1.8× off") in the
   recap, or only marks and points?
6. ? Should the recap show what the *median* player guessed per round (once
   data exists), or is that answer-adjacent information after reveal OK?
7. ? Do passes count toward any "completed" notion for streaks, or is a
   passed-all-rounds day a completed day (currently yes)?
8. Should archive attempts have a separate "best of N replays" notion, or
   is strictly first-replay-only final?
9. ? Should there be a practice mode with random past puzzles that never
   records anything?
10. Is the round mix fixed forever, or should weekends get a variant mix
    (e.g. two target matches on Saturday)?

### Content & editorial

11. Who is the editorial owner, and what is the review SLA for content
    reports (currently stored with no triage surface)?
12. Should every live puzzle require a secondary reviewer sign-off before
    publishing, and where does that flag live in the schema?
13. What is the source-citation policy — must every claim have a URL, or are
    "authoritative source, no URL" (e.g. a book) cases acceptable?
14. How are "as of" dates handled when a fact changes (e.g. a record is
    broken mid-week)? Auto-deprecate the puzzle? Manual swap?
15. Is there a maximum acceptable error factor for a *best* target-match
    entry (currently the validator only enforces ≥90 points), so the "best"
    answer always feels fair?
16. How many eligible entries should a target-match list ideally show — the
    schema allows big sets; is there a UX cap (top-N by alphabetical order)?
17. ? Should hints be mandatory per round, or optional per round type?
18. ? Do we need image hints in v1 at all (currently implemented with
    fallback), or is text/figure enough until artwork exists?
19. Who sources hint artwork, and what license classes are acceptable?
20. ? Should there be an editorial calendar (puzzle scheduled N days ahead)
    visible in an admin UI, or is file-based content enough?

### Identity, privacy & data

21. Is device-bound cookie identity acceptable at launch, or do we need
    lightweight cross-device sync (name + passcode) before day one?
22. Should the guest cookie ID ever be linked to an email for "email me my
    streak reminders", and what consent flow would that require?
23. What is the data-retention policy for attempts, reports and site_events?
    (Currently: forever.)
24. Are content reports anonymous to editors, or should they carry the guest
    ID for follow-up questions?
25. Do we need a GDPR-style export/delete endpoint for a guest's own data at
    launch, or is that deferred until accounts exist?
26. ? Is IP-based abuse detection needed in addition to guest-token rate
    limits (currently token-only)?

### Sharing, social & comparison

27. Should share links expire (e.g. after 90 days) or live forever?
28. Is the share payload shape final (marks only), or should it include a
    tiny emoji grid like Wordle for social recognition?
29. Should comparison require completing the *same mode* (daily vs daily) or
    is any-mode comparison acceptable (currently: same puzzle, any completed
    attempt)?
30. Do we want per-question comparison against the *community* (percentiles
    per round) once 50+ guesses exist, shown to everyone or only on request?
31. ? Should there be a friends/follow system, or is link-sharing the whole
    social layer for v1?
32. ? Should revoking a link break previously-copied embeds/preview cards
    (currently yes, link goes neutral)?

### UX & design

33. Is the dark "observatory" theme the only theme, or do we need a light
    mode / high-contrast mode (prefers-color-scheme) at launch?
34. Should the input offer a numeric keypad layout on mobile for all rounds,
    or keep the text keyboard because suffixes (k/m/b) need letters?
35. ? Should there be keyboard-only play support (1-5 to pick rounds, Enter
    to lock) beyond the current Enter/arrow support?
36. ? Do we want sound effects (lock, reveal) with a persistent mute toggle?
37. Is the confetti/stamp animation family the right level of "playful", or
    should big scores (450+) get a more distinctive celebration?
38. ? Should the recap ring colour shift by score band (red→gold) or stay
    brand-gradient regardless of score?
39. ? Is a "how scoring works" one-screen explainer needed on first play?
40. ? Should the archive list show your mark pattern per puzzle (like the
    recap) once completed, or keep the table minimal?

### Accessibility & i18n

41. Are WCAG AA contrast targets required for all text (some dim text is
    currently ~AA-borderline on glass surfaces)?
42. Do we need screen-reader-optimised result summaries (currently aria-live
    and list roles are present but untested with real AT)?
43. Which languages matter for v2 — is English-only acceptable through 2027?
44. Are number formats locale-aware in scope (the parser is English
    decimal-point only; autocorrect accepts decimal commas as a courtesy)?

### Analytics & metrics

45. Which KPIs define success — D1/D7 return rate, completion rate, share
    rate, streak length distribution?
46. What analytics pipeline is approved (self-hosted, no third-party
    trackers?) and what events beyond the current site_events are needed?
47. ? Should site_events get a daily rollup job to keep the table small?
48. ? Do we want funnel instrumentation on invalid-input errors (which
    correction paths players actually use)?

### Operations & deployment

49. What is the target hosting platform for production (this decides the
    PGlite→hosted-Postgres swap and the shared rate limiter)?
50. What uptime/monitoring stack is expected (error tracking, uptime check
    on /api/estimation/status)?
51. What is the backup/restore story for the Postgres instance, and how
    often do we rehearse it?
52. Is there a CDN/edge requirement for share pages (cacheable HTML for
    anonymous viewers is possible — currently force-dynamic)?
53. ? Do we need a staging environment with synthetic data for editorial
    review before puzzles go live?

### Compliance & legal

54. Do we need a privacy policy and cookie notice page at launch (the guest
    cookie is strictly functional, but notice may still be required)?
55. Are there jurisdictional constraints on "no accounts, no email" play
    (e.g. age minimums for data collection)?
56. Do source URLs on reveal screens need any license review (we hotlink
    out; is that always OK)?
57. ? Is a terms-of-service needed before public sharing of results begins?

### Monetization & growth (later)

58. Is the game free forever, or is there a supporter tier (cosmetics,
    archive depth, stats) that changes what we must build now?
59. ? Should streaks "freeze" during vacations (a paid feature elsewhere) —
    decide the philosophy before players build habits around it.
60. ? Do we want an embeddable result card (og:image generator) for social
    sharing, and does it leak any restricted data?

### Roadmap

61. What is game #2 ("Rarity") and does it share the same attempt engine —
    if yes, which attempt-service assumptions do we keep generic now?
62. ? Is there a desired launch date that constrains any of the above?

---

## A. Deviations from the handoff document

### A1. PGlite locally, hosted PostgreSQL in production (dual-mode client)
The handoff specifies PostgreSQL with versioned SQL migrations. No Postgres
server is installed in this environment, so local development runs on
`@electric-sql/pglite` (a genuine Postgres build compiled to WASM, embedded
in the Node process). Setting `DATABASE_URL` switches the same code to a
hosted PostgreSQL via `pg` — same `Queryable` interface, same SQL, same
migrations; services are untouched. On serverless hosts (Netlify) PGlite
cannot persist (ephemeral filesystem), so production always uses
`DATABASE_URL`; see `DEPLOY.md`. Consequences worth knowing:

- Single connection per process, so services are transaction-aware
  (transaction-bound helpers take the client explicitly). A hosted pool with
  multiple connections runs the same code, but the code must stay
  transaction-clean; a lint/test rule against `q()` inside transactions would
  be a reasonable safeguard.
- Tests can't run the DB suite under vitest: PGlite's WASM aborts under
  vitest's module runner (`Aborted(). Build with -sASSERTIONS…`). The
  integration suite therefore runs under plain Node via `tsx`
  (`tests/integration.mts`, assert-based, in-memory database). Unit tests for
  pure logic stay in vitest. `npm test` runs both, and CI (GitHub Actions)
  runs typecheck + the full suite on every push.
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

### A6. Autocorrect is advisory and opinionated
The handoff doesn't specify typo handling. Guessed numbers that fail the
strict parser now get an *offered* correction ("Did you mean 900?") computed
by `src/lib/domain/autocorrect.ts`: lookalike letters (O→0, l/I→1), exotic
digit scripts, currency symbols and wrapping prose ("about 900"), appended
units ("900 kg"), broken grouping ("1.234.567", "3,50,000", "1'000"), doubled
decimal points, and the decimal-comma ambiguity ("5,00" → 5 in measured
mode, 500 in count mode). Corrections are never applied silently and the
server re-validates the confirmed value. Target-match input gets unique-best
fuzzy matching (edit distance scaled by word length); ambiguous typos are
never guessed, and the suggest endpoint falls back to the same fuzzy match
when no prefix matches. Flag any heuristic you disagree with — e.g. whether
a stripped minus sign ("-900" → "900") should be offered.

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
  restarts and do not aggregate across instances (on Netlify: per function
  instance, so limits are approximate).
- No full-text search or filtering in the archive beyond the date index.
- The parser supports the handoff's grammar (units suffixes, grouping,
  scientific notation, fractions of counted things rejected) but not
  spelled-out English numbers ("eight hundred").
- Migrations are never auto-applied in hosted mode; a fresh database must be
  migrated/seeded once via `npm run db:migrate && npm run db:seed` with
  `DATABASE_URL` set (see `DEPLOY.md`).

*(Resolved since first written: `next build` now passes — all routes build
with the dynamic/static split as intended; security headers, favicon,
robots.txt and CI are in place.)*
