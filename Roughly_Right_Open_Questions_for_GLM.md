# Roughly Right — Open-question decisions for GLM

**Scope.** Build and verify Roughly Right in its own repository and deployment. This document answers all 62 questions in `OPEN_QUESTIONS.md` and gives dispositions for every numbered deviation, implementation choice and launch gap. The revised standalone handoff takes precedence over earlier shared-site wording. Treat recommendations as implementation defaults unless Jack overrides them. Work can proceed locally and against isolated staging. Owner approval is required before public publication, paid infrastructure or policy sign-off.

## Repository baseline and priorities

I reviewed [Roughly Right main](https://github.com/Jacklee504/roughlyright), [open questions](https://github.com/Jacklee504/roughlyright/blob/main/OPEN_QUESTIONS.md), [scoring](https://github.com/Jacklee504/roughlyright/blob/main/src/lib/domain/scoring.ts), [autocorrect](https://github.com/Jacklee504/roughlyright/blob/main/src/lib/domain/autocorrect.ts), [importer](https://github.com/Jacklee504/roughlyright/blob/main/src/lib/content/import.ts), [seed script](https://github.com/Jacklee504/roughlyright/blob/main/scripts/seed.ts), [database client](https://github.com/Jacklee504/roughlyright/blob/main/src/lib/db/client.ts) and [deployment guide](https://github.com/Jacklee504/roughlyright/blob/main/DEPLOY.md). Source checks only. No deployed site, test execution or device QA was verified.

1. **Fix the production content path.** `scripts/seed.ts` imports both fixture and live directories. `import.ts` writes puzzles as live, and its fixture branch can reach the date upsert without applying the same immutability check as live input. The deploy guide currently instructs operators to use this seed command with the production connection. Keep demo seeding local/staging only and create an explicit approved-live-only publication path. Reject fixtures even if the JSON is passed directly to the live importer. Test that a fixture cannot overwrite a published date. Freeze the target dataset used by a published question, including entries, aliases and values.
2. **Freeze published puzzle numbers.** The current importer renumbers existing rows. Allocate a unique number once at first public release. Preserve existing public result references. Unpublished local fixture numbers can be reset. Backfills after launch use an archive-only label and cannot change published sequences or streaks.
3. **Keep the real scoring contract.** The ratio formula is already implemented using exact rational arithmetic and tests. The 100/50/0 question is stale. Preserve marks, half/double symmetry and score boundaries.
4. **Prevent semantic changes in input suggestions.** Keep explicit confirmation. Never strip a sign, guess which number in an expression was intended, switch units or reinterpret malformed grouping as a different number. Named suggestions before Lock are alphabetic prefix matches, with names only. Update the instructions and tests for corrected behavior.
5. **Separate deployment state.** Production uses its own hosted PostgreSQL and a distinct host-only guest cookie. The repo package description still mentions a shared site. Correct README/deploy instructions where outdated. An optional muted link to Deep Pick can be configured after both sites go live.

## Questions 1–62

| ID | Decision |
|---|---|
| 1 | Keep continuous points: `round(100 × min(guess,target) / max(guess,target))`. Marks are descriptive, rather than 100/50/0 bands. Keep Exact, Close, In range, Far and Pass. |
| 2 | No exact bonus. 100 per round and 500 per day. An inexact guess can round to 100 and still say Close. |
| 3 | Keep the 00:30 UTC next-day cutoff. No configurable finish-window setting in v1. |
| 4 | Keep partial progress privately resumable until expiry. After expiry, label the attempt Incomplete in the owner's history and offer one unranked archive attempt. Do not publish its partial score or give a streak credit. |
| 5 | Show score and mark in the compact recap. Show error factor, direction and unit in expanded review. No error factor for a pass. |
| 6 | Omit median guesses in v1. Use thresholded, post-completion percentiles only. |
| 7 | Yes. Five terminal outcomes including five passes count as a completed ranked day. An abandoned run does not. |
| 8 | One eligible unranked replay per date and guest. No best-of or multiple replays. |
| 9 | No random practice mode in v1. Use staging fixtures and the archive for testing. |
| 10 | Keep one direct fact, three calculations and one target match in that order. The permitted fallback replaces only the final target round with a second direct fact. No weekend variants in v1. |
| 11 | Jack or delegated editor owns content. Review the private report queue weekly and triage an active-puzzle blocker the same day it is discovered. Build a CLI with list and status updates. Do not email players. |
| 12 | Every live puzzle needs one named editor's approval. No mandatory second reviewer. Record reviewer and review date in version-controlled release metadata checked by the production importer. |
| 13 | Cite a reliable source for each measured or reported fact. Offline sources are fine with publisher, title, edition/date and page or location. Explicitly label a representative assumption where a source provides no single number. |
| 14 | Freeze published answers and their underlying data. Date changing facts or tie them to an edition. Replace an unpublished puzzle if necessary. For released mistakes, publish a correction note and preserve historical results. |
| 15 | Keep the current best-entry threshold of at least 90 rounded points. Apply editorial plausibility review, including a clearly scoped set with several reasonable candidates. No second numeric threshold. |
| 16 | Show at most eight alphabetical prefix suggestions after three normalized characters. No full visible eligible list before lock. Show at most three co-best entries after reveal plus the count of further ties. |
| 17 | Hints are optional and free on numerical fact and calculation rounds. No hints on target matches in v1. Keep all eligibility and interpretation details in the visible prompt or scope. |
| 18 | Keep support for text, figure and licensed images. A round may ship without imagery. On failure, render a text fallback that conveys the same useful scale without giving the answer. |
| 19 | GLM can nominate assets, with Jack or delegate approving. Allow original media, verified public-domain assets, or explicit reuse licences compatible with intended distribution. Keep licence, source, credit and alt text. Confirm the particular asset's rights before use. |
| 20 | File-based scheduling and a CLI calendar check are enough for v1. No operator UI. |
| 21 | Device-bound cookie identity is accepted. No name, passcode or cross-device sync in v1. |
| 22 | Do not collect email, link it to guest IDs or add reminders in v1. |
| 23 | Proposed defaults: keep guest-linked play data while active and purge after 12 months of inactivity. Delete reports 12 months after closing. Retain granular operational events 90 days and anonymous daily rollups 12 months. Publish the approved policy and define backup expiry with Jack before production. |
| 24 | Reports are anonymous to editors. Use report ID for triage. Keep any internal abuse linkage restricted and out of analytics. No direct guest follow-up. |
| 25 | Add authenticated-by-current-guest-cookie export and deletion on the privacy page, plus a contact route. Deletion removes guest-linked history and revokes links. Exclude other players' data, internal abuse counters and unreleased answer keys from export. Require deliberate confirmation only for deletion. |
| 26 | Yes for public mutation and suggestion endpoints. Use coarse network keys with limited retention plus per-guest limits. No raw IP values in public analytics or application-level report exports. |
| 27 | Keep links live while the underlying result is retained. Revocation or guest deletion invalidates them immediately. No additional fixed expiry. |
| 28 | Share game name, date or number, total and five labelled marks. Optional emoji alongside text is fine. Keep answers, guesses and workings out. |
| 29 | Same puzzle, either completed mode. Require owner opt-in and identify Daily/Archive per run. |
| 30 | Show the qualifying percentile by default in completed per-round review, only to the owner of that completed ranked result. Leave percentiles out of friend comparison and archived results. Require at least 50 other eligible completed ranked guesses on the same puzzle and round. Compare strict-worse raw error factors and exclude the result owner, passes and archive runs. |
| 31 | Link sharing is the social feature in v1. No follow or friends system. |
| 32 | Revocation makes origin links and generated previews neutral on next fetch. Previously copied text, screenshots and cached third-party previews can persist. Keep these spoiler-free. |
| 33 | Keep the dark observatory look for v1. Fix contrast and preserve legibility under system forced-colours and reduced-motion settings. No standalone light theme. |
| 34 | Keep text-capable input so `k/m/b/t` are easy to enter. On mobile, use an optimized keypad only if visible accessible suffix controls preserve entry. Named target input always uses a text keyboard. |
| 35 | Support keyboard Start, Lock, hint, Pass, suggestion selection and Next. No numeric shortcuts to jump rounds. |
| 36 | No sound effects in v1. |
| 37 | Keep the existing modest reveal stamp/animation where accessible. No extra 450+ celebration. Respect reduced motion. |
| 38 | Keep a brand-gradient recap ring. Score and mark must be readable text. |
| 39 | Add a short expandable scoring explainer at ready/recap. Include one example where reciprocal errors score equally. No forced first-run tutorial. |
| 40 | Keep compact archive rows with date, status and the viewer's saved score if any. No per-round mark grid in the list. |
| 41 | Yes. Target WCAG 2.2 AA contrast across meaningful text including muted copy. Normal text at least 4.5:1 and large text at least 3:1. Test against the actual rendered glass/background. |
| 42 | Yes. Test accessible summary, focus and one concise live announcement for submitted results on real VoiceOver and desktop AT. Prevent duplicate announcements. |
| 43 | English-only is approved for the v1 scope. No calendar promise through 2027 or automatic v2 translations. Prioritize future languages only after audience evidence. |
| 44 | Use the documented English decimal point and valid thousands groups. Reject ambiguous decimal commas and mixed grouping. Keep explicit safe corrections only. |
| 45 | Use D7 return among first-time finishers as primary. D1, completion, shares and correction rates help diagnose. Use 20% D7 as a directional starting target and avoid a performance verdict below 100 qualified first-time finishers. |
| 46 | First-party PostgreSQL events only. Collect start, resolve/outcome, finish, share and coarse correction reason. No third-party tracker or raw guess payload. |
| 47 | Yes. Add a daily aggregate job and retention cleanup per Q23. Use atomic, restart-safe rollups. |
| 48 | Count invalid-input reason by round type and whether the player corrected it. Do not retain the invalid text. |
| 49 | Deploy Roughly Right on its own **Netlify** project with pooled hosted PostgreSQL, consistent with its existing packaging. Vercel remains an owner override. Use per-deployment shared PostgreSQL rate-limit counters. Fail clearly if production lacks database configuration. |
| 50 | Use a five-minute uptime probe on `/api/estimation/status`, with simple alerting on two consecutive failures, and redacted structured logs for 5xx, resolve and publish failures. Also alert if a scheduled daily is absent. No required paid external tracker. |
| 51 | Use daily backups or point-in-time recovery. Rehearse restoring to a separate environment before launch and quarterly thereafter. Verify at least one ranked recap, one archived result and the next scheduled puzzle. |
| 52 | No CDN/edge requirement. Keep response generation dynamic where it depends on viewer completion or revocation. Prevent public caching of owner/comparison data. |
| 53 | Yes. Use independent staging credentials and storage. Synthetic fixtures can live there, clearly labeled. |
| 54 | Publish accurate privacy and cookie information before public launch. A strictly necessary guest cookie can qualify for a consent exemption. Verify actual cookies, logs and providers. Keep optional trackers off. |
| 55 | No age gate proposed for v1. Before public launch Jack confirms the intended territory and audience and reviews applicable child-data obligations. Pause public release if that review requires additional controls. |
| 56 | Ordinary source links are fine. Check asset or dataset reuse terms before republishing text, images or derived entries. Asset hotlinking does not establish reuse permission. |
| 57 | Publish short terms/rules covering submissions, link visibility, misuse and contact. No forced click-through for this iteration unless owner review requires it. |
| 58 | Free at launch. No supporter tier, paywall or monetization architecture now. No promise of permanent pricing. |
| 59 | No streak freezes in v1, paid or free. |
| 60 | Defer an OG image generator behind release fixes. If built, limit it to date/number, total, marks and brand. Never include guesses, hints, values, prompts, source or worked steps. |
| 61 | Game #2 is **Deep Pick**, a separate site. Neither app calls the other's attempt engine or shares DB credentials or cookies. Pattern reuse is welcome. Enable an external link only once the other production URL is known. |
| 62 | No fixed launch date. Run an invited staging pilot with up to 20 players. Release after approved 14-day content, privacy, production-path and device QA sign-off. |

## A. Deviations

- **A1.** Keep local PGlite and hosted `pg`. Prefer pooled Neon PostgreSQL or any approved equivalent. Run the same migrations and a full smoke against hosted staging. Keep integration tests under plain Node if needed. Document the existing `DATABASE_URL` selection. Run migration tests on PostgreSQL to catch statement-splitting or transaction discrepancies.
- **A2.** Keep `src/middleware.ts` with the current app structure and test that it sets the expected host-only guest cookie.
- **A3.** Keep an empty detail string for events with no detail. Do not add a nullable PK redesign.
- **A4.** Keep malformed-ID validation and structured 400 responses.
- **A5.** Keep test clock injection isolated from production player and operator inputs.
- **A6.** Keep confirmation with only unambiguous formatting repairs. Reject sign removal, wrong or mismatched units, multi-number strings, ambiguous grouping and arithmetic. Retain simple typo proposals only for unique named matches after Lock. Keep the Estimation handoff's v1 parser grammar, which excludes exponent notation. Preserve exact expected-unit acknowledgement as a correction only when no conversion is involved.
- **A7.** Separate sites. Branding is **Roughly Right**. Keep optional cross-promotion disabled until configured with the other game's verified URL.

## B. Implemented choices

- **B1.** Keep the audience and threshold in Q30.
- **B2.** Keep existing per-route guest thresholds as initial values. Use a shared PostgreSQL counter for production, with normal play/retry load tests and coarse network protection.
- **B3.** Keep current same-origin POST state/hint routes. Avoid an API redesign for method semantics alone.
- **B4.** Keep three-character, eight-label prefix suggestions. Remove fuzzy fallback from autocomplete. A unique after-Lock correction can require explicit confirmation.
- **B5.** Keep co-best ties and the up-to-three display with a further count.
- **B6.** Replace global renumbering with first-publication assignment. A backfill cannot change existing shares.
- **B7.** Keep expiry as incomplete and replay unranked. UI must never imply an expired or archive-only completion saved a daily streak.

## C. Launch gaps

- **C1.** Add dimensional reduction checks and exact benchmark recomputation with declared rounding. Start with the units needed by the first 14 days. Reject invalid expressions, missing conversion assumptions and incompatible output units.
- **C2.** GLM drafts 14 real dated dailies, each with a sourced input/answer and concise worked explanations. Jack or delegated editor approves. Production rejects synthetic material.
- **C3.** Ship licensed assets where useful, otherwise text/figures. Remove placeholder SVGs from the live schedule.
- **C4.** Implement private operator CLI triage per Q11. No email integration.
- **C5.** Add browser automation for desktop and mobile Chromium and WebKit. When a real device is available, run iPhone Safari with VoiceOver, Android Chrome and keyboard-only desktop. Cover submit, retry, reload, hint and image fallback, target disambiguation, archive completion, share/revocation, deletion and UTC rollover. Do not treat emulation as real-device sign-off.
- **C6.** Keep browser-specific identity. No accounts or cross-device recovery for v1.
- **C7.** Use “Closer than X% of players who guessed.” The percentage is rounded down, counts strict-worse error factors and applies Q30's minimum.

## D. Prototype limitations

Replace instance-local public limits and add first-party rollups. Keep archive date navigation without full-text search. Keep text and number-parser scope as specified. Migrations remain a deliberate hosted release command. Use a separate live-content command from local seeding. Update deployment instructions and document which checks were actually run.

## Launch verification and references

Test production missing-DB failure, migration and restore against hosted staging, concurrent submissions, fixture exclusion and immutable answer/number behavior. Test 0/100/500 edges, exact versus rounded 100, invalid numeric repair cases, unreleased-answer isolation and spoiler-free unfurls. Record commit, environment, date, browsers and actual results. Mark pending hardware tests explicitly.

References: [Netlify Next.js support](https://docs.netlify.com/build/frameworks/framework-setup-guides/nextjs/overview/), [WCAG 2.2 contrast guidance](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html), [Irish DPC cookie guidance](https://www.dataprotection.ie/en/dpc-guidance/guidance-cookies-and-other-tracking-technologies), [GDPR text, Articles 13 and 17](https://eur-lex.europa.eu/eli/reg/2016/679/oj). Jack still owns actual credentials, legal copy, editorial approval and public release timing. These are approval gates for launch, while local work can proceed.
