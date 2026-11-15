# Daily Estimation — web game implementation handoff for GLM

**Deliverable.** Build the general-knowledge Estimation game and any shared website functionality it needs. This document is self-contained. Follow it whether this is the first work in the repository or Rarity already exists. Build a playable web application. Treat the implementation defaults below as decisions for version one unless an existing project constraint requires an equivalent implementation. Record any deviation.

## Product brief

**Player promise.** Make five real-world estimates. Get closer to earn more points. You might estimate the mass of a Mars rover, work out how many loaves an acre of wheat yields, or name a film with a runtime close to a given target. You can make a guess from general knowledge, intuition or rough maths. After each guess, see the answer and how somebody could have reasoned their way toward it.

This is a Fermi- and Plain-adjacent **web game**. Fermi informs the back-of-the-envelope questions, the comparison against a benchmark and the worked reveal. Plain informs the occasional round that gives a target number and asks the player to name something close to it. The main daily consists of questions with numerical answers, with calculation-based questions making up its biggest share. The game should feel like an approachable general-knowledge puzzle for adults and teens. The core interaction is reading, making one guess and seeing the result.

**Confirmed scope.** Two games on a shared website, Estimation can be prototyped first, and Rarity gets the lead position once both are public. Estimation uses real measurements, defensible worked estimates and an occasional target round. Hints are allowed in Estimation. Their exact presentation is a future editorial decision. The first implementation must support them, with simple configurable defaults below. There are no power-ups, swaps, bonus rounds or streak-dependent modifiers. Existing decisions on hints in Rarity apply only to Rarity.

**Core measures.** Does a guest finish? Do they start the next daily? Which calculation prompts produce meaningful guesses or useful reports about wording and assumptions? Can the player understand why 80 and 125 were equally close to 100? Keep the first version small enough to learn from the answers.

## Shared website contract

### Product and ownership

Build responsive, mobile-first **browser games** that load from ordinary HTTPS links. Both live on **one website**, under one brand, with a shared landing page and navigation. Players can play as guests on phones, tablets and desktops. Use original branding, copy, questions, examples and visual assets. Reference games inform the experience. The labels **Rarity** and **Estimation** are working labels. Keep them configurable and use the route slugs `rarity` and `estimation`.

- `/` is the landing page. Give Rarity the primary position when both games are public. Each live game gets its own Play or Continue button and completion status. During partial rollout, show the playable game with a working entry point and omit the unreleased game from navigation.
- `/rarity` and `/estimation` are the two daily game routes. Each keeps its own attempt, completion, score, history and streak. Finishing one never consumes the other.
- `/rarity/archive` and `/estimation/archive` list released dates before the current daily date, with archive pages at `/{game}/archive/YYYY-MM-DD`. A completed date opens the existing recap. Skipped dates or previously unfinished ranked dates can be played once as unranked archive puzzles. A date with a ranked attempt still inside its finish window offers Continue first. An already completed archive run opens its recap. Archive results can be shared as archive scores and have their own population excluded from the ranked daily statistics.
- `/rarity/collection` is the guest’s Rarity collection. Results live at `/{game}/result/{publicToken}`, where the token is an opaque, randomly generated, unguessable identifier. A link is a view link. Possession grants access to the intended share view only.
- Reuse any existing repository, framework, component library, database and release conventions that support this contract. If starting greenfield, use **Next.js App Router with TypeScript, PostgreSQL, versioned SQL migrations and a small typed domain layer**. Keep scoring, attempts, puzzle release and presentation as distinct modules. Use a single shared application and database. Avoid provider-specific dependencies until hosting is chosen. The work includes a local run path, not production publication or infrastructure purchases.
- The two handoffs deliberately repeat this contract. Either can be sent to a fresh implementation agent. When the other game already exists, extend its shared components and data rather than creating a second layout, calendar, guest ID or storage system.

### Calendar, attempts and state

Treat these as implementation defaults. **Reset at 00:00 UTC globally.** Use the server clock for puzzle selection, countdowns, deadlines and authoritative score writes. Store dates as UTC calendar dates and timestamps as timezone-aware UTC. Show the next reset as a countdown with a readable time in the player’s browser timezone. Both games use the same date boundary and each has an independent sequence number starting at its first release.

The guest identity is an opaque random server-issued token in an HttpOnly, SameSite=Lax cookie, Secure in production. Keep the player’s history server-side for that browser. Guest play never requires registration. Clearing site data or using another browser starts a fresh identity. Account sign-in and cross-device sync are follow-up features. Public tokens and analytics never contain the guest cookie or raw guest ID.

- A **daily** attempt can be created only while its puzzle is the current daily. Atomically get or create it for the guest and puzzle. A started daily may finish for up to **30 minutes after its date ends**. It keeps its original UTC date, rules and prompt order. Starting the new daily is independent of finishing yesterday’s. On expiry, freeze the old ranked record as incomplete and offer a fresh unranked archive attempt. No new ranked attempts exist for prior dates.
- The maximum of one scored attempt applies **per guest, game and date**. Archive attempts have a distinct mode and never affect any daily streak. Enforce uniqueness in the database for `(guest_id, puzzle_id, mode)`. Repeated starts and double-clicks return the same attempt.
- Home loads status without creating an attempt. Start creates or resumes an attempt and returns its current state. Serve only the current prompt and its approved public fields. After the round resolves, show the reveal, then wait for Next. Opening, resolving and advancing are explicit operations. Saving a draft locally is optional. It is never required for scoring. A reload restores the last committed server state, including a resolved round waiting for Next.
- Each round has exactly one terminal outcome. Store the canonical submission, outcome, points, answer or benchmark revision and server timestamps through a transaction. Give irreversible requests a request ID. Exact retries return the original outcome. A conflicting request for an already-resolved round returns its saved state and cannot alter the answer. Verify attempt ownership and expected round ordinal on every mutation. Use a row lock or equivalent atomic compare and update to protect racing browser tabs.
- After the final round, finalize the attempt, score and completion date together and return the recap. A complete attempt with skips or zero scores still qualifies for a completion streak. Current streak counts consecutive **released daily dates completed**. If today is complete, start at today. Otherwise start at the most recent released date strictly before today. If that date is missing a completion, current streak is zero. Scan backward over released dates until the first missing completion. Dates with no published puzzle do not enter the sequence. Compute best streak over the entire released-date sequence. Compute from unique completed dates so late completion is credited to the correct day and cannot earn two days. Show current and best separately.
- If a puzzle is missing, unavailable or invalid at release, show a clear unavailable state with working archive and other game links. Use the real server UTC date. Do not recycle yesterday’s puzzle as today’s. Future content, its answers and unpublished hints must stay off the client payload and public pages. Render clear keep-playing, wait, unavailable, expired and retry states.

### Results, accessibility and presentation

- Daily recap shows game, date and puzzle number, total out of 500, five individually labelled outcomes and next reset. Include prompt-level answer review via expand controls. Use deliberate focus movement and short announcements for errors and results. Keep the UI compact and usable with one hand.
- **Share result** generates a plain-text, spoiler-free result with game, puzzle number, total and five marks with a text description. Use the device share sheet when available and a Copy result fallback. The share preview, API response, metadata and link unfurl must omit prompts, answers, individual guesses and solution facts. Support avoidable spoilers via a normal link flow, not a secrecy guarantee against a player who deliberately completes the round to see solutions.
- Show prompt-level friend comparisons on the share link only after the viewer finishes the same puzzle themselves. The default share link has comparison off. The owner explicitly enables comparison when creating its link. Require completion of the same puzzle ID in either mode. The share page labels each run as Daily or Archive when comparing different modes. Reveal only the displayed guess or canonical answer and outcome needed for comparison. Keep arbitrary rejected free text private. Keep guest identifiers private. The owner can revoke the public token. Invalid, revoked and unknown tokens return a neutral unavailable page. No public global leaderboard is required.
- Build distinct game identities inside one design system. Use type, contrast and motion for feedback. Every score tier or accuracy state also has a text label. Respect reduced motion. All controls work by touch, keyboard and screen reader, including submit, pass, results, sharing and optional hint disclosure. Use a visible focus state, appropriate form labels and adequately sized interactive targets. Maintain usable layout at 320 CSS px and in landscape, and never rely on hover. Keep photos optional at render time with meaningful alt text. Leave text, score and progression readable during loading.
- Expensive imagery is optional. Use licensed or original media and record the attribution and rights. Avoid brand imitation, third-party embeds for essential gameplay and interstitial steps before the first question.
- Track only the minimum useful site events internally: start, round resolved, completion, share action, content report and scheduled theme tag. Aggregate by date and game. Individual guest IDs and raw invalid entries do not enter public analytics. Once published participation is sufficient, expose the mode-specific aggregate described later. A published minimum applies consistently even where a thin slice is tempting to show.

### Data, server and content workflow

Implement the following as a logical contract regardless of framework naming.

| Record | Required fields and rules |
|---|---|
| Game | Stable slug, launch date or disabled status, UI copy and rules version. |
| Puzzle | Stable ID, game slug, UTC date, display number, optional theme tag, content revision, rules version, status and ordered list of exactly five prompt revision IDs. Unique per game and date. |
| Prompt revision | Stable prompt ID, immutable revision ID, category, prompt, public scope or unit where relevant, private scoring data, explanatory text and source records. Store media metadata where used. |
| Attempt | Stable ID, guest ID, puzzle ID, mode, state, current ordinal, started at, completed at, daily expiry when applicable and running or final score. |
| Attempt round | Attempt ID and ordinal unique, revision ID, opened at, optional deadline, outcome, submitted canonical value or applicable private normalized value, points and resolved at. |
| Share result | Opaque token, owner attempt, comparison flag, created at and optional revoked at. |
| Content report | Prompt revision, reason, proposed answer or correction, optional supporting URL, created at and workflow status. Private to editorial operators. Limit abuse without interrupting normal play. |

**Suggested server boundary.** Implement these operations as application actions or HTTP endpoints. Use the repository’s routing style. Keep ownership, idempotency and timing checks in the shared service. The response can use a tagged result object to make client recovery explicit.

| Operation | Inputs | Result and side effects |
|---|---|---|
| Get game status | Game, optional calendar date, guest cookie | Current UTC date, available puzzle and schedule metadata, attempt status and reset time. Read only. |
| Start or resume | Game, puzzle date and requested mode | One owned attempt and current presentation state. Initial Start arms the first round. Within the daily finish window, return the earlier ranked attempt for an older unfinished date rather than creating an archive sibling. |
| Resolve | Attempt ID, expected ordinal, request ID, tagged guess or pass | Validation feedback if recoverable, otherwise the stored outcome and reveal. A Rarity timeout can be finalised lazily when reading or mutating a round after its deadline. |
| Advance | Attempt ID, expected resolved ordinal and request ID | First successful advance opens the next prompt or returns the recap. A repeated request never advances twice or refreshes a deadline. |
| Get recap or archive | Owned attempt or game and date | A completed run’s scoped result or archive entry. Archive indexes expose dates and status, with review restricted to completed runs. |
| Create or revoke share | Owned completed attempt, comparison preference on create, token on revoke | Returns the spoiler-free link or revokes it. Write access always requires the owner's guest session. |

Keep completed and expired attempts read-only. If load or submit fails temporarily, show Retry and reload authoritative state before offering another irreversible action. A guest who attempts to start tomorrow's puzzle should see the same unavailable response as anyone else. The server must choose the appropriate date before relying on editorial metadata.

Prefer typed editorial files and a small importer for version one. Keep public prompt data and private answer keys in separate projections. The server reads private content from the database or server-only modules. The browser receives public prompts, its own committed reveal and permitted recap data through allowlisted DTOs. Keep answer keys out of static assets, HTML, open graph tags, client bundles, public source maps and browser preload data. Treat browser input as untrusted. Apply per-guest and coarse network rate limits to mutations, parameterize DB access and escape submitted text. Protect write routes against cross-origin submissions using the framework’s same-origin protections or an equivalent origin check.

Use source records with title, publisher and URL where available, and note date, scope, asset credit and usage rights as needed. Validate before scheduling, including duplicate IDs, malformed references, slot mix and logical integrity. Allow preview using local fixtures or restricted editorial access. Publish whole puzzles as atomic revisions. Keep scoring inputs immutable once the puzzle goes live. Correct factual copy with an editorial note. For a confirmed scoring error, record the correction for a future revision, label affected results if necessary and preserve historical comparisons. Make unpublished edits freely. Keep a 14-release-date source-reviewed buffer per live game as the initial editorial target. This is a launch-readiness target, not a limitation on local development.

### Implementation, verification and handoff to the owner

1. Inspect the repo. Use its existing setup and verify what is already present. Add only the shared pieces and requested game needed at this stage.
2. Implement an end-to-end guest loop first, including authoritative scoring, real persisted progress and result recap. Use deterministic fixtures and a test-only injectable clock. Then complete the archive, sharing, editorial imports and polish.
3. Add automated checks for scoring and content validation, persistence and API integration, and browser flows on mobile and desktop. Cover duplicated submissions, a refresh after submit, advancing twice, wrong guest, a rejected answer key exposure attempt, stale revisions, UTC rollover and same-date replay. Check accessible focus, touch target size, reduced motion and a 320 px layout.
4. Verify local boot from a clean setup, run migrations and seed commands, run formatting, type checks and tests, and execute a full mobile and desktop happy path. Provide commands to run locally, required environment variable names with example values, the file or command for adding and scheduling a puzzle, and evidence of what passed. Separate demonstration fixtures from approved live content. Record deviations and unresolved implementation questions.
5. Treat the game as ready when a guest can finish, revisit their results, share a spoiler-free score, play a missed puzzle and return to the correct next daily on both mobile and desktop. Ensure the sibling game’s registration and routes work if already present. The requested scope is two daily games, with occasional theme days inside the same routes. Independent sport, geography, science and history games are follow-up product decisions.

## Estimation game requirements

### Daily mix, round types and player flow

The reference daily uses **three calculation estimates, one direct numerical fact and one target match**, in the order `direct_fact, calculation, calculation, calculation, target_match`. Rotate content categories across these slots. The opening fact is an accessible warm-up. The three calculation questions should vary in the reasoning they invite. The target match is the one Plain-style round in the reference daily. Support authoring a day without a target match by substituting one more direct numerical fact in the final slot. Use the reference mix for the initial seeded schedule wherever a reviewed target dataset exists. The schedule explicitly records the slot variants.

- **Direct fact.** Ask for a published numerical fact, such as an object's mass, the height of a structure or a dated official attendance count. Identify the object/version and measurement boundary in the prompt or scope. The reveal gives the official figure and a concise fact or comparison.
- **Calculation.** Ask for a number people can estimate from two to four smaller quantities, such as wheat yield × flour recovery ÷ flour per loaf. Use familiar objects and settings where possible. Set a reproducible benchmark with a formula, inputs and units. The benchmark is the result under declared assumptions. The reveal explains those assumptions and how the pieces combine. A valid prompt leaves at least one substantive quantity or step to estimate. Straight unit conversion is acceptable as a demonstration fixture but too thin as the main reasoning challenge in a live calculation round.
- **Target match.** Give a bounded category, a unit and a positive numerical target. Accept one named entity from the verified category dataset, then score its measured value against the target. Example: “Name a feature film whose original theatrical runtime is closest to 150 minutes.” Give the scope precisely. A close choice earns points even if another eligible item was closer. The recap shows the player’s item and one or more best known dataset matches. Label that scope accurately, especially for broad categories.

**Interaction.** One locked answer per round. Estimation is **untimed in version one** so a player can work through the numbers. No score or streak depends on elapsed time. The shared daily finish window still applies. A browser back, reload or tab switch restores the current server state. Round numbers and current score stay visible. Each resolved round shows a short reveal immediately. Next advances explicitly, and the fifth resolve persists the recap. Pass resolves the round for zero and shows the same explanation. Opening the hint never affects the score.

1. Start shows the category, prompt, fixed answer unit and input. Show the units outside the editable text, next to the field and in its accessible label. Use a numeric-friendly mobile input where possible while allowing magnitudes and suffixes. Display a live parse preview once the value is valid, for example `2.5k → 2,500 loaves`.
2. For a numerical round, use one text field and **Lock guess**. Submitting invalid syntax or a value outside the supported positive range keeps the round open and explains the issue. A valid number is final after the server commits it. Confirmation screens are unnecessary for ordinary valid guesses because the formatted preview makes the parsed value clear.
3. For a target match, use a named text field and **Lock guess**. Show prefix suggestions only after three normalised characters. Offer up to eight eligible labels sorted by label, independent of their distance from the target. A suggestion includes only its name and a disambiguator if needed. No measurement values, rarity ranking, defaults or prefilled answers before lock. Treat a selection as filling the field, with Lock guess as a separate action. An exact eligible label or alias can be locked without selecting a suggestion. Unrecognised or ambiguous input gets an inline explanation and can be corrected. Guest and coarse network rate limits cover repeated lookups.
4. On the reveal, show the player's guess, official figure or benchmark, points and direction. Use “higher than target” or “lower than target” for named target rounds and “high” or “low” for numerical guesses. For a numerical guess also show the absolute gap with its unit. For a target match show the selected item's measurement and the closest eligible dataset entry or entries. A pass has no submitted value or error amount. Show the answer, source, and the same worked reveal on a pass.
5. On the recap, show the total out of 500, a five-round breakdown and the closest scored round by raw factor closeness, using earliest round as tie-break. If all rounds were passes, omit the closest label. Include short answer review, archive, share and the sibling game's route if live. The spoiler-free mark set can use Exact, Close, In range, Far and Pass. Define the bands below and include text in the copied payload.

### Hints

Support optional, server-supplied hint data per prompt. Supported primitives are one short text hint, one figure with a unit and scope, and one illustrative photo with alt text, credits and rights. Allow at most one hint block per prompt, with up to one image and short supporting text or figure together. When authored, display a readily discoverable **Show hint** disclosure. Any context essential to interpreting the question belongs in the visible prompt or scope so everybody can answer correctly.

- Direct fact example: a licensed image of the Curiosity rover beside people gives a sense of scale. Its alt text communicates that scale without including the scored numerical answer. A text-only equivalent remains usable if images are unavailable.
- Bread calculation example: a representative recipe quantity of flour per loaf gives the player one factor. Baked loaf weight can be supporting context. It only belongs in the actual formula if the benchmark converts from baked mass using sourced assumptions.
- Calculation hints can give an anchor such as a unit conversion or familiar quantity. Leave the other inputs or inference for the player to estimate. Never send the scored answer embedded in the photo name, markup, alt text or visible hint content.
- The examples are authoring options. A valid daily can use any combination of hint-bearing and hint-free prompts. Ship fixtures covering text, image, figure and no hint, plus an inline note and text fallback for image load failure. Hint use stays free and does not affect comparability.

### Exact scoring contract

Version one scores **positive finite numeric inputs**, in the question’s prescribed unit. Choose an allowed range of **10⁻⁹ through 10¹⁵ inclusive** for both guesses and benchmarks. Content requiring zero, negative values, calendar years, percentages, dates or a separate bounded-scale rubric can be added later with its own rules version. Volumes, dimensions, weights, elapsed durations, rates, speeds, quantities and positive counts fit the same first-release rule. The range exists to prevent pathological inputs and make arithmetic predictable.

Let `g` be the normalised guess or chosen entity's verified value and `t` the fixed target or benchmark. Calculate:

```text
ratioClose = min(g, t) / max(g, t)
rawPoints  = 100 × ratioClose
points     = floor(rawPoints + 0.5)
errorFactor = max(g, t) / min(g, t)
```

Use decimal-safe arithmetic or rational storage for fixed decimal values and deterministic tie handling. Persist the normalised chosen numeric value, target revision and integer points. The source value and the scoring value must use a documented precision. Display enough figures on the reveal to reproduce the score. A calculation benchmark may be rounded to an editorially meaningful precision before publishing. Store and score against that rounded, published number. The displayed daily total is the sum of five round points, from 0 to 500.

Classify the individual reveal by the unrounded ratio, using numeric equality for Exact.

| Mark | Condition |
|---|---|
| Exact | `g = t` |
| Close | `0.90 ≤ ratioClose < 1` |
| In range | `0.50 ≤ ratioClose < 0.90` |
| Far | `ratioClose < 0.50` |
| Pass | The player passed. There is no ratio. |

| Benchmark | Guess or selected value | Points | Mark |
|---:|---:|---:|---|
| 100 | 100 | 100 | Exact |
| 100 | 100.4 | 100 | Close |
| 100 | 80 | 80 | In range |
| 100 | 125 | 80 | In range |
| 100 | 50 | 50 | In range |
| 100 | 200 | 50 | In range |
| 100 | 10 | 10 | Far |
| 100 | 0.5 | 1 | Far |
| 100 | 0.49 | 0 | Far |
| 100 | Pass | 0 | Pass |

Avoid implying that a display score of 100 always means numerical equality. Show `100 pts · Close` where it rounded up. For target matches with equally close answers, award equal points. On a best-match tie, treat all equal-raw-ratio choices as co-best and show up to three names in alphabetical order, with a count for further ties. The target round can have no exact entry, so a perfect daily score is possible only where all five scores can round to 100. Validate that the best target match can earn at least 90 points and that the dataset also has plausible distractors. Archive points use the same immutable formula and revision as the original date.

**Number parser.** Use the same grammar for preview and server validation, with the server authoritative. Accept English-formatted positive decimals, including `.5` and `0.5`, and whole numbers, such as `5000`, `5,000` or `5 000`. Support valid comma or space thousands groups, and simple suffixes `k`, `thousand`, `m`, `million`, `b`, `billion`, `t` and `trillion`, case-insensitively. A suffix scales the number in the displayed answer unit. The UI label gives examples. Reject malformed groupings, mixed grouping separators, regional decimal-comma ambiguity, non-finite values, zero, negative numbers, arithmetic expressions, scientific notation and appended unit strings. Trim exterior whitespace and normalise normal Unicode whitespace. Cap raw input length at 64 characters and the expanded output range as above. For count prompts, accept positive whole numbers only after suffix expansion. For measured values, accept decimals up to nine fractional digits after expansion. Give precise player messages for invalid input. Example: “Enter a number in kilograms, like 900 or 1.2k.”

**Optional community data.** Once there are at least 50 non-pass guesses on a prompt from completed ranked daily attempts, show the viewer’s closeness percentile or a compact graph. The percentile is the fraction of other non-pass players whose error factor is strictly larger, using the unrounded factor. Exclude the viewer from the comparison. Use “Closer than X% of players who guessed.” At least 50 other guesses must exist before showing that wording to an individual. Graph bins can use score proximity ranges and suppress cells below five observations. No raw guesses are exposed through aggregates. Points never depend on the crowd.

### Editorial contract and data

| Round type | Scoring record | Reveal record |
|---|---|---|
| Direct fact | Positive canonical value, fixed unit, source, declared precision, as-of date or edition when applicable. | Brief explanation, source title and URL, measurement scope and optional familiar comparison. |
| Calculation | Formula description, structured positive input values and units, input references or explicit editorial assumptions, unrounded derivation, chosen rounded benchmark and scope. | Two to four steps with the quantities, operations, units and source notes. Label the final value “Worked estimate”. |
| Target match | Category dataset revision ID, target value and unit, entry IDs, canonical labels and aliases, measurement values, source records, and eligible scope or exclusions. | Chosen value, target, closest eligible entries with values and the source for each displayed value. |

Keep inputs comparable by choosing conditions up front. A prompt about bicycle mass should specify the model or use a well-defined representative benchmark. A moving statistic needs a year and a source with the appropriate geography. A fictional, regional, event-dependent or disputed quantity needs narrower wording, a declared benchmark or a different prompt. Show all interpretation-critical details before the guess. The reveal can explain why an assumption was chosen and mention alternatives in one sentence. The official score still uses the common benchmark.

Define benchmark inputs from primary or credible sources where possible. Mark a documented representative assumption plainly when no single universal value exists. Use data that a player can reason toward through a couple of familiar anchors. Prefer a range of domains including food, science, history, sport, geography, entertainment and everyday life. Write original prompts and reveals. Fermi and Plain are references for mechanics and pacing, not content sources for bulk reuse.

For target sets, use a documented data snapshot licensed for the proposed use and support repeated questions from the same dataset across distinct target values. Prefer bounded collections with clear eligibility, such as mountains in a named dataset or original theatrical runtimes in a defined collection. Each published target set needs at least five eligible entries and the closeness check above. Resolve spelling and aliases against the dataset. Normalise comparison keys with Unicode NFKC, case folding, diacritic removal, consistent punctuation handling and collapsed whitespace. Use year or model disambiguators where duplicate titles or names exist. Fail import if ambiguous keys could silently map to multiple entities. Ask the user to clarify ambiguous input. Avoid returning measurement values from any autocomplete endpoint.

Validate all published content automatically. Reject bad number ranges, missing units, missing target dataset entries, aliases that collide, calculation units that do not reduce to the output, missing source or assumption notes, invalid score precision, malformed hints and duplicate revisions. Recompute each worked benchmark from its stored inputs within the declared rounding rule. Require editor review that hint copy and media do not disclose the result, that wording matches the scoring quantity, and that the steps are engaging. Distinguish QA fixtures from live prompts. A report button in answer review accepts a short explanation and optional source link.

### Example daily suitable for prototype fixtures

| Slot | Prompt | Hint option | Reveal plan |
|---|---|---|---|
| Direct fact | What is the mass of NASA’s Curiosity rover itself in kilograms? | A photo of the rover beside engineers, with a text description that conveys scale. | NASA reports 899 kg for the rover. Cite NASA and identify the measured object. |
| Calculation | Roughly how many loaves of sandwich bread could you make from the wheat grown on one acre, using a representative wheat harvest and a 450 g flour recipe? | Flour per loaf can instead appear in a hint if the visible wording identifies the representative loaf used. For the first fixture, give 450 g explicitly in the prompt and make the hint a picture. | Illustrative test inputs give 3,000 kg wheat × 0.75 flour recovery ÷ 0.45 kg per loaf = 5,000 loaves. For a public puzzle, specify crop, country and harvest year in the scope, source the yield and milling assumptions and cite the recipe. |
| Calculation | How many individual steps would a representative runner take to finish a marathon? | The official race distance is 42.195 km. | Estimate distance per step. A fixture using 1.2 m per step produces 35,162.5, rounded to 35,000 for a representative benchmark. For a public puzzle, define the runner model in the scope and source or label the step-length assumption. |
| Calculation | How many sheets of standard office paper stacked flat would reach the top of the Eiffel Tower, including its antenna? | A ream of 500 sheets is about 5 cm thick for the paper used here. | Divide the sourced height by the thickness of a sheet, under the declared paper specification. An illustrative fixture with 330 m and 0.05 m per ream yields 3,300,000 sheets. |
| Target match | Name a feature film whose original theatrical runtime is closest to 150 minutes. | A concise scope note defines the starter dataset. | Show the selected runtime, its gap and the best match in the verified film dataset, with sources. Use an explicitly synthetic dataset for unit tests. |

These examples describe format, not a pre-approved live content bank. NASA’s Curiosity value and the official marathon distance are sourced below. The representative wheat yield, extraction rate, recipe, step length, paper thickness and fixture dimensions must be checked for the exact scope before publication. The bread example is the editorial model. It should invite the player to estimate several sensible quantities, then reward them with the arithmetic and assumptions once the answer is locked.

### Estimation-specific acceptance tests

- A daily accepts three calculation prompts, one direct fact and one target match, with a second direct fact permitted only in the final slot as specified. Reject schedules with missing required slots, invalid target sets or future content carrying conflicting revisions.
- A guest can reason for several minutes without a timer ending an open round. On reload the answer field and hint allowance are available. A reload after a valid submit cannot allow a second guess. Pass and valid submit racing result in exactly one committed terminal state.
- Every scoring example in the table returns the exact published point total and mark. Confirm near-exact rounded 100, half/double symmetry, unit consistency, threshold rounding, exact matches and co-best target entries. Run valid and invalid parser fixtures for suffixes, decimals, en dashes used as minus signs, comma grouping, spaces, unit suffixes, unexpanded range and count integrality.
- A malformed guess displays an error with the input still editable. Numbers in the preview and safe server response agree. Hint use produces identical score and streak outcomes. A failed image loads a readable fallback and keeps the quiz playable.
- Autocomplete and starting payloads contain only allowed fields. Submitting an accepted entity returns its stored value after resolution. A retry cannot change that value or switch the archived revision. A player can share all five marks without disclosing answers, steps or guesses.
- The worked reveal for the bread fixture recomputes exactly to 5,000 at fixture precision. A changed input with an unchanged scoring benchmark fails editorial validation. The visible benchmark and stored scoring benchmark are identical at published precision.
- Launch the application against a fresh DB, seed representative data, complete a daily on desktop and mobile and replay a missed date. Confirm a player can finish without a calculator and can complete the same puzzle using their own scratch work. An optional built-in calculator can follow if players need one.

### Scope after the first release

Science & Nature is the strongest themed estimation candidate to try inside the daily. Sport can contribute race times, margins, distances, capacities and comparison questions. History can contribute ages, durations and amounts expressed in suitable units. Geography can contribute areas, genuine distances and population figures. Launch one daily Estimation game, with occasional themed days. Standalone specialist dailies depend on player returns and editorial capacity.

### Product and example references

- [Fermi overview](https://fermi.gg/about) and [Fermi archive](https://fermi.gg/archive), including its calculation-based and real-world number formats.
- [Plain rules and scoring](https://playplain.app/how-to-play) and [Plain question history](https://playplain.app/questions), covering typed target matches and numerical rounds.
- [NASA’s Mars Science Laboratory mission page](https://science.nasa.gov/mission/msl-curiosity/) lists the rover’s mass.
- [World Athletics marathon overview](https://worldathletics.org/disciplines/road-running/marathon) lists the official race distance.
