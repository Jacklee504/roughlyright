# Open Questions & Deviations

Decisions made while implementing the handoff contract that either (a)
diverge from the document, (b) fill in details the document leaves open, or
(c) need a product/editorial call before launch. Grouped by who needs to
decide.

---

## Resolution log (Nov 2026)

All 62 questions are now **resolved** by the owner's answers document
(`Roughly_Right_Open_Questions_for_GLM.md`). Status of implementation:

**Resolved and implemented in this pass**

- Q1/Q12/C2 — strict production import path (`npm run content:publish`):
  rejects fixture material, requires `content/live/approvals.json` with a
  named editor + review date per puzzle date, and freezes datasets referenced
  by published puzzles. Local seeding stays `npm run db:seed`.
- Q2/B6 — display numbers are assigned once at first publication
  (`max(display_number)+1`); renumbering removed entirely.
- Q10 — slot mix shipped as one direct fact, three calculations, one target
  match (fallback: second direct fact replaces the final target round).
- Q11/C4 — report triage CLI (`scripts/triage.mts` list/resolve/dismiss).
  No email integration, per the owner.
- Q13 — every input in generated content is either sourced (publisher/title)
  or explicitly labelled "Assumption:".
- Q14 — published puzzles freeze; the importer refuses to replace a live
  puzzle with different content outside a deliberate revision.
- Q15 — best-entry threshold stays at ≥90 rounded points; editorial
  plausibility review is part of the approval step.
- Q16/B4 — autocomplete is prefix-only (3 chars, 8 labels); the fuzzy
  fallback on the suggest endpoint was removed. Fuzzy matching remains in the
  after-lock resolve flow only.
- Q17 — hints exist only on numerical fact and calculation rounds; target
  matches never show or serve a hint.
- Q18/Q19 — library ships with text/figure hints only (no image hints yet).
- Q20 — file-based scheduling + `scripts/verify-content.mts` as the calendar
  check. No operator UI.
- Q21/Q22 — device-bound cookie only; no email collection.
- Q23/Q47 — `scripts/jobs-daily.mts` (`npm run jobs:daily`): atomic
  restart-safe rollups of `site_events` from attempt ground truth, plus
  retention (12-month inactive attempts purge, closed reports deleted after
  12 months, granular operational events retained 90 days is operator-tunable
  — the shipped cleanup removes rollup rows older than 12 months).
- Q25 — privacy page (`/privacy`) with cookie-authenticated export and
  deletion. Export contains only the guest's own attempts/rounds/share
  tokens (no reports, no abuse counters, no answer keys). Deletion requires
  typed confirmation and clears the session cookie.
- Q28/Q29 — verified conformant (marks-only payload; same-puzzle either-mode
  comparison with per-run labelling and owner opt-in). No changes needed.
- Q30/C7 — percentiles shown only to the owner of a completed ranked daily,
  gated at ≥50 other eligible completed ranked guesses, strict-worse error
  factors, owner/passes/archive runs excluded.
- Q33 — dark-only theme; the premium light theme was removed.
- Q39 — short expandable "How scoring works" explainer on the first question
  card and in the recap, with the reciprocal-errors-equal example. No
  forced tutorial.
- Q54 — privacy/cookie notice published on `/privacy` ahead of launch.

**Resolved — remaining work is owner-owned**

- Q12 (approval): `approvals.json` must be filled in with a real named editor
  before any production publish; gates are deliberate.
- Q49–Q53, Q62: staging pilot (≤20 invited players), device QA (real
  VoiceOver/desktop AT per Q42), backup rehearsal (Q51), uptime probe (Q50)
  and the 14-day sign-off remain the owner's launch gates.
- Q55/Q57: owner territory/audience review and short terms/rules page before
  public release.

**Deviations recorded**

- **Freemium removed entirely (Q58).** An earlier build shipped a supporter
  tier (premium columns, redeem codes, upgrade page, gated archive/insights,
  light theme). The owner's answer ("free at launch, no monetization
  architecture") reversed this: the whole surface was deleted
  (`migrations/0003_drop_premium.sql` drops the dormant columns; archive and
  insights are free; `dev:premium` removed).
- **Question library is mathematics-first (Q13/Q17).** The 300-question
  launch library (dates 2026-11-16…2027-01-14) contains only defined unit
  conversions, exact constants, Fermi calculations and quantitative
  datasets — no single-figure trivia. 14 of 180 calculations carry a hint
  (always one figure, never all inputs); hints appear on no direct facts and
  no target matches. Generated content lives in `content/live/` and validates
  with the production validator.
- **A6 narrowed per Q16/B4:** the suggest endpoint no longer falls back to
  fuzzy matching (see above); autocorrect heuristics remain advisory at
  resolve time.

---

## Question bank (needs owner input)

*Historical record — every question below was answered in
`Roughly_Right_Open_Questions_for_GLM.md` (Nov 2026); see the resolution log
above for what changed in code.*

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
    (Note per A7: Rarity would be a separate site, so "sharing" means
    reusing code patterns, not co-hosting.)
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
never guessed. **Update (Q16/B4, Nov 2026):** the suggest endpoint no longer
falls back to fuzzy matching — autocomplete is prefix-only; fuzzy correction
applies after a lock, not during live suggestions. Flag any heuristic you
disagree with — e.g. whether a stripped minus sign ("-900" → "900") should
be offered.

### A7. Games are separate websites, not one shared site
The handoff says both games live on **one website** under one brand with a
shared landing page and navigation. Owner decision overrides this: each game
is a **completely separate entity/site**. The only permitted link between them
is quiet cross-promotion — a single muted line on the home and results
screens, "nothing OTT". Implemented via `SIBLING_GAMES` in
`src/lib/site.ts` (currently an empty array, so nothing renders). Consequences:
the handoff's shared landing page, shared navigation, "Rarity gets the lead
position once both are public", and `/rarity/collection` page cohabitation do
not apply as written; Rarity (if/when built, see question 61) would live on
its own domain/codebase and reuse patterns rather than routes.

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
6. **Display-number assignment** — ~~import renumbers~~ **REPLACED per Q2/B6
   (Nov 2026):** numbers are assigned once at first publication
   (`max(display_number)+1` per game) and never renumbered, so shared result
   references stay stable.
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
   `content/fixtures/` is invented for demonstration. **Closed per Q1/C2
   (Nov 2026):** fixtures are local demo material only — the production
   import path rejects them, they never displace live dailies in seeding,
   and real launches publish only approved `content/live/` material via
   `npm run content:publish`.
3. **Hint images** are placeholder SVGs (`public/hint-images/`); the data
   model and the image/text fallback are implemented, but no real artwork
   exists. Who produces hint artwork, and under what rights model (the
   importer requires credit + rights strings)?
4. **Report triage** — content reports are stored (private, rate-limited).
   ~~Where should reports land~~ **RESOLVED per Q11/C4 (Nov 2026):** private
   CLI triage (`npx tsx scripts/triage.mts list|resolve|dismiss`); no email.
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
