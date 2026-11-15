/**
 * Attempt lifecycle. Invariants from the handoff contract:
 * - One scored attempt per guest, puzzle and mode (enforced by unique index).
 * - A daily attempt can start only while its puzzle is current; it may finish
 *   up to 30 minutes after its date ends (00:30 UTC next day), keeping its
 *   original date, rules and prompt order. Expired runs freeze as incomplete.
 * - Exactly one terminal outcome per round; request IDs give idempotency;
 *   row locks protect racing tabs; repeated requests return the saved state.
 */

import { getDb, q, type Queryable } from "@/lib/db/client";
import { parseDecimalToRat, rat, cmp, div, sub, type Rat } from "@/lib/domain/decimal";
import { scoreValue, direction as guessDirection } from "@/lib/domain/scoring";
import { parseNumber, formatDisplay } from "@/lib/domain/numberParser";
import { repairNumberInput, fuzzyEntityMatches, type FuzzyCandidate } from "@/lib/domain/autocorrect";
import { normalizeKey } from "@/lib/domain/text";
import { utcToday, dailyFinishWindowEndIso, nextResetIso } from "@/lib/domain/calendar";
import { now } from "@/lib/domain/clock";
import type { AttemptState, PromptPublic, Recap, RoundResolved } from "@/lib/dto";
import { getPuzzleByDate, getPromptRevisions, getPromptRevision, type PromptRevisionRow, type PuzzleRow } from "./puzzles";
import { buildCommunityPercentile } from "./stats";

export type StartInput = { game: string; date?: string; mode?: "daily" | "archive" };
export type StartResult =
  | { ok: true; state: AttemptState }
  | { ok: false; code: "unavailable" | "not_found" | "forbidden" | "stale"; message: string };

export type ResolveInput =
  | { attemptId: string; ordinal: number; requestId: string; pass: true }
  | { attemptId: string; ordinal: number; requestId: string; pass: false; guess?: string; entity?: string };

export type ResolveResult =
  | { ok: true; state: AttemptState }
  | { ok: false; code: "invalid_input" | "wrong_guest" | "not_found" | "stale" | "expired" | "conflict"; message: string; suggestion?: string };

export type AdvanceInput = { attemptId: string; ordinal: number; requestId: string };
export type AdvanceResult =
  | { ok: true; state: AttemptState }
  | { ok: false; code: "not_found" | "wrong_guest" | "round_not_resolved" | "stale" | "expired"; message: string };

export type AttemptRow = {
  id: string;
  guest_id: string;
  puzzle_id: string;
  mode: string;
  state: string;
  current_ordinal: number;
  started_at: Date;
  completed_at: Date | null;
  completion_date: string | null;
  daily_expiry: Date | null;
  score: number;
};

export type AttemptRoundRow = {
  attempt_id: string;
  ordinal: number;
  revision_id: string;
  opened_at: Date;
  deadline: Date | null;
  outcome: string | null;
  submitted_value: string | null;
  submitted_entity: { entryId: string; label: string; value: string } | null;
  points: number | null;
  mark: string | null;
  error_factor: string | null;
  request_id: string | null;
  resolved_at: Date | null;
};

type SourceRef = { title: string; url?: string | null; note?: string | null };
type CalcInput = { name: string; value: string; unit: string; source?: SourceRef | null; assumption?: string | null };
type PrivateScoring =
  | { type: "direct_fact"; value: string; precision: number; source: SourceRef; asOf?: string | null }
  | { type: "calculation"; formula: string; inputs: CalcInput[]; outputUnit: string; precision: number; roundTo?: number | null; benchmark: string | null; steps: string[] }
  | { type: "target_match"; datasetId: string; target: string; eligibleEntryIds?: string[] | null };
type RevealRecord = {
  explanation: string;
  sourceTitle?: string | null;
  sourceUrl?: string | null;
  comparison?: string | null;
  steps?: string[] | null;
};

// ---------------------------------------------------------------------------
// Start / resume
// ---------------------------------------------------------------------------

export async function startOrResume(guestId: string, input: StartInput): Promise<StartResult> {
  const game = input.game;
  const today = utcToday();
  const date = input.date ?? today;
  if (date > today) {
    return { ok: false, code: "unavailable", message: "That date hasn't been released yet." };
  }
  const puzzle = await getPuzzleByDate(game, date);
  if (!puzzle) {
    return { ok: false, code: "unavailable", message: "No puzzle is published for that date." };
  }

  const db = await getDb();
  return db.transaction(async (tx) => {
    // Within the daily finish window, an unfinished ranked attempt takes priority
    // over creating an archive sibling.
    const daily = await getAttemptFor(tx, guestId, puzzle.id, "daily");
    if (daily) {
      const frozen = await freezeIfExpired(tx, daily);
      if (frozen.state !== "expired" || date === today) {
        return { ok: true, state: await buildState(tx, frozen, puzzle) };
      }
      // Expired ranked run: fall through and offer a fresh unranked archive attempt.
    }

    let mode: "daily" | "archive";
    if (date === today) {
      mode = "daily";
    } else {
      mode = input.mode === "daily" ? "daily" : "archive";
      if (mode === "daily") {
        return { ok: false as const, code: "unavailable" as const, message: "Ranked daily attempts can only start on their own date." };
      }
    }

    const existing = await getAttemptFor(tx, guestId, puzzle.id, mode);
    if (existing) {
      const frozen = await freezeIfExpired(tx, existing);
      return { ok: true, state: await buildState(tx, frozen, puzzle) };
    }

    const id = crypto.randomUUID();
    const isDaily = mode === "daily";
    await tx.query(
      `insert into attempts (id, guest_id, puzzle_id, mode, state, current_ordinal, started_at, daily_expiry)
       values ($1,$2,$3,$4,'active',1,$5,$6)`,
      [
        id,
        guestId,
        puzzle.id,
        mode,
        now(),
        isDaily ? new Date(dailyFinishWindowEndIso(date)) : null,
      ],
    );
    await armRound(tx, id, 1, puzzle.prompt_revision_ids[0]);
    await recordEventTx(tx, game, "start", isDaily ? "daily" : `archive:${date}`);
    if (puzzle.theme_tag) await recordEventTx(tx, game, "theme_tag", puzzle.theme_tag);
    const attempt = await getAttemptFor(tx, guestId, puzzle.id, mode);
    return { ok: true, state: await buildState(tx, attempt!, puzzle) };
  });
}

async function getAttemptFor(tx: Queryable, guestId: string, puzzleId: string, mode: string): Promise<AttemptRow | null> {
  const rows = await tx.query<AttemptRow>(
    `select id, guest_id, puzzle_id, mode, state, current_ordinal, started_at, completed_at,
            completion_date::text as completion_date, daily_expiry, score
     from attempts where guest_id = $1 and puzzle_id = $2 and mode = $3 for update`,
    [guestId, puzzleId, mode],
  );
  return rows.rows[0] ?? null;
}

/** Lazy expiry: freeze an active daily attempt whose finish window has passed. */
async function freezeIfExpired(tx: Queryable, attempt: AttemptRow): Promise<AttemptRow> {
  if (
    attempt.state === "active" &&
    attempt.mode === "daily" &&
    attempt.daily_expiry &&
    new Date(attempt.daily_expiry).getTime() <= now().getTime()
  ) {
    await tx.query(`update attempts set state = 'expired' where id = $1 and state = 'active'`, [attempt.id]);
    attempt.state = "expired";
  }
  return attempt;
}

async function armRound(tx: Queryable, attemptId: string, ordinal: number, revisionId: string): Promise<void> {
  await tx.query(
    `insert into attempt_rounds (attempt_id, ordinal, revision_id, opened_at) values ($1,$2,$3,$4)
     on conflict (attempt_id, ordinal) do nothing`,
    [attemptId, ordinal, revisionId, now()],
  );
}

async function recordEventTx(tx: Queryable, game: string, event: string, detail: string | null): Promise<void> {
  const day = utcToday();
  await tx.query(
    `insert into site_events (day, game_slug, event, detail, count) values ($1,$2,$3,$4,1)
     on conflict (day, game_slug, event, detail) do update set count = site_events.count + 1`,
    [day, game, event, detail],
  );
}

// ---------------------------------------------------------------------------
// State assembly (allowlisted DTO only)
// ---------------------------------------------------------------------------

export async function getAttemptState(guestId: string, attemptId: string): Promise<StartResult> {
  const db = await getDb();
  return db.transaction(async (tx) => {
    const rows = await tx.query<AttemptRow>(
      `select * from attempts where id = $1 and guest_id = $2 for update`,
      [attemptId, guestId],
    );
    const row = rows.rows[0];
    if (!row) return { ok: false as const, code: "not_found" as const, message: "Attempt not found." };
    const frozen = await freezeIfExpired(tx, row);
    const puzzle = await puzzleOf(tx, frozen);
    return { ok: true, state: await buildState(tx, frozen, puzzle) };
  });
}

async function buildState(tx: Queryable, attempt: AttemptRow, puzzle: PuzzleRow): Promise<AttemptState> {
  const rounds = await tx.query<AttemptRoundRow>(
    `select attempt_id, ordinal, revision_id, opened_at, deadline, outcome, submitted_value,
            submitted_entity, points, mark, error_factor, request_id, resolved_at
     from attempt_rounds where attempt_id = $1 order by ordinal asc`,
    [attempt.id],
  );
  const revisionRows = await getPromptRevisions(puzzle.prompt_revision_ids, tx);

  const currentOrdinal = attempt.current_ordinal;
  const currentRevision = revisionRows[currentOrdinal - 1];
  const currentRound = rounds.rows.find((r) => r.ordinal === currentOrdinal) ?? null;

  let prompt: PromptPublic | null = null;
  let resolved: RoundResolved | null = null;

  if (attempt.state === "active" && currentRevision) {
    if (!currentRound) {
      await armRound(tx, attempt.id, currentOrdinal, currentRevision.revision_id);
      prompt = toPromptPublic(currentOrdinal, currentRevision);
    } else {
      prompt = toPromptPublic(currentOrdinal, currentRevision);
      if (currentRound.outcome) {
        resolved = await buildResolved(currentRound, currentRevision, puzzle, tx);
      }
    }
  }

  let recap: Recap | null = null;
  if (attempt.state === "completed") {
    recap = await buildRecap(attempt, puzzle, revisionRows, rounds.rows, tx);
  }

  const share = await tx.query<{ token: string }>(
    `select token from share_results where attempt_id = $1 and revoked_at is null order by created_at desc limit 1`,
    [attempt.id],
  );

  return {
    attemptId: attempt.id,
    mode: attempt.mode as "daily" | "archive",
    puzzleDate: puzzle.date,
    displayNumber: puzzle.display_number,
    themeTag: puzzle.theme_tag,
    state: attempt.state as AttemptState["state"],
    ordinal: currentOrdinal,
    score: attempt.score,
    expiresAt: attempt.daily_expiry ? new Date(attempt.daily_expiry).toISOString() : null,
    prompt,
    resolved,
    recap,
    shareToken: share.rows[0]?.token ?? null,
  };
}

function toPromptPublic(ordinal: number, rev: PromptRevisionRow): PromptPublic {
  return {
    ordinal,
    roundType: rev.round_type as PromptPublic["roundType"],
    category: rev.category,
    prompt: rev.prompt_text,
    scope: rev.scope,
    unit: rev.unit,
    countMode: rev.count_mode,
    hintAvailable: rev.hint != null,
  };
}

// ---------------------------------------------------------------------------
// Target datasets
// ---------------------------------------------------------------------------

type EntryRow = {
  entry_id: string;
  label: string;
  disambiguator: string | null;
  value: string;
  source: SourceRef;
  aliases: string[];
};

async function eligibleEntries(datasetId: string, eligibleIds: string[] | null | undefined, client?: Queryable): Promise<EntryRow[]> {
  const res = client
    ? await client.query<EntryRow>(
        `select entry_id, label, disambiguator, value, source, aliases from target_entries where dataset_id = $1`,
        [datasetId],
      )
    : { rows: await q<EntryRow>(
        `select entry_id, label, disambiguator, value, source, aliases from target_entries where dataset_id = $1`,
        [datasetId],
      ) };
  const rows = res.rows;
  const filtered = eligibleIds ? rows.filter((r) => eligibleIds.includes(r.entry_id)) : rows;
  return filtered.sort((a, b) => a.label.localeCompare(b.label));
}

/** Co-best matches: all entries sharing the maximum ratioClose, alphabetical. */
function bestMatches(target: Rat, entries: EntryRow[]): { best: EntryRow[]; bestRatio: Rat } {
  let bestRatio: Rat | null = null;
  let best: EntryRow[] = [];
  for (const e of entries) {
    const v = parseDecimalToRat(e.value);
    if (!v) continue;
    const [min, max] = cmp(v, target) < 0 ? [v, target] : [target, v];
    const ratio = div(min, max);
    const c = bestRatio ? cmp(ratio, bestRatio) : 1;
    if (c > 0) {
      bestRatio = ratio;
      best = [e];
    } else if (c === 0) {
      best.push(e);
    }
  }
  return { best: best.sort((a, b) => a.label.localeCompare(b.label)), bestRatio: bestRatio ?? rat(0n) };
}

// ---------------------------------------------------------------------------
// Resolve
// ---------------------------------------------------------------------------

export async function resolveRound(guestId: string, input: ResolveInput): Promise<ResolveResult> {
  const db = await getDb();
  return db.transaction(async (tx) => {
    const rows = await tx.query<AttemptRow & { game_slug: string }>(
      `select a.*, p.game_slug from attempts a join puzzles p on p.id = a.puzzle_id
       where a.id = $1 for update of a`,
      [input.attemptId],
    );
    const attempt = rows.rows[0];
    if (!attempt) return { ok: false as const, code: "not_found" as const, message: "Attempt not found." };
    if (attempt.guest_id !== guestId) {
      return { ok: false as const, code: "wrong_guest" as const, message: "This attempt belongs to another browser." };
    }
    await freezeIfExpired(tx, attempt);
    if (attempt.state === "expired") {
      return { ok: false as const, code: "expired" as const, message: "This daily's finish window ended. It is saved as incomplete; you can replay the date unranked in the archive." };
    }
    if (attempt.state !== "active") {
      const puzzleRow = await puzzleOf(tx, attempt);
      return { ok: true as const, state: await buildState(tx, attempt, puzzleRow) };
    }
    if (input.ordinal !== attempt.current_ordinal) {
      return { ok: false as const, code: "stale" as const, message: "That round is not the open one — reloading the latest state." };
    }

    const puzzle = await puzzleOf(tx, attempt);
    const roundRows = await tx.query<AttemptRoundRow>(
      `select * from attempt_rounds where attempt_id = $1 and ordinal = $2`,
      [attempt.id, input.ordinal],
    );
    const round = roundRows.rows[0];
    if (!round) return { ok: false as const, code: "stale" as const, message: "Round not open." };

    // Idempotency: exact retries return the original outcome.
    if (round.outcome) {
      return { ok: true as const, state: await buildState(tx, attempt, puzzle) };
    }

    const revision = await getPromptRevision(round.revision_id, tx);
    if (!revision) return { ok: false as const, code: "stale" as const, message: "Prompt revision missing." };
    const scoring = revision.private as PrivateScoring;

    let outcome: "scored" | "pass";
    let points = 0;
    let mark = "Pass";
    let submittedValue: string | null = null;
    let submittedEntity: { entryId: string; label: string; value: string } | null = null;
    let errorFactor: string | null = null;

    if (input.pass) {
      outcome = "pass";
    } else if (revision.round_type === "target_match") {
      if (scoring.type !== "target_match") return { ok: false as const, code: "stale" as const, message: "Scoring data mismatch." };
      if (!input.entity || !input.entity.trim()) {
        return { ok: false as const, code: "invalid_input" as const, message: "Type the name of an item from the list, then lock your guess." };
      }
      const entries = await eligibleEntries(scoring.datasetId, scoring.eligibleEntryIds, tx);
      const wanted = normalizeKey(input.entity);
      const match = entries.find(
        (e) =>
          normalizeKey(e.label) === wanted ||
          normalizeKey(e.disambiguator ? `${e.label} (${e.disambiguator})` : e.label) === wanted ||
          e.aliases.some((a) => normalizeKey(a) === wanted),
      );
      if (!match) {
        // Advisory autocorrect: offer a close typo correction only when there
        // is exactly one best candidate (ambiguity never gets guessed).
        const cands: FuzzyCandidate[] = entries.flatMap((e) => {
          const forms = [e.label, e.disambiguator ? `${e.label} (${e.disambiguator})` : null, ...e.aliases];
          return forms.filter((f): f is string => !!f).map((display) => ({ display, entryKey: e.entry_id }));
        });
        const hits = fuzzyEntityMatches(input.entity, cands, normalizeKey);
        const best = hits[0];
        const tie = hits.length > 1 && hits[1].distance === best?.distance && hits[1].candidate.entryKey !== best?.candidate.entryKey;
        let suggestion: string | undefined;
        if (best && !tie) {
          const bestEntry = entries.find((e) => e.entry_id === best.candidate.entryKey);
          // The plain label is always an accepted match form on resolve.
          suggestion = bestEntry?.label ?? best.candidate.display;
        }
        return {
          ok: false as const,
          code: "invalid_input" as const,
          message: `We couldn't match "${input.entity.trim()}" to an item in this list. Try the suggestions, or check the spelling.`,
          ...(suggestion ? { suggestion } : {}),
        };
      }
      submittedEntity = { entryId: match.entry_id, label: match.label, value: match.value };
      submittedValue = match.value;
      outcome = "scored";
      const scored = scoreValue(parseDecimalToRat(match.value)!, parseDecimalToRat(scoring.target)!);
      points = scored.points;
      mark = scored.mark;
      errorFactor = stringifyRat(scored.errorFactor);
    } else {
      const parsed = parseNumber(input.guess ?? "", revision.count_mode ? "count" : "measured", revision.unit);
      if (!parsed.ok) {
        const repair = repairNumberInput(input.guess ?? "", revision.count_mode ? "count" : "measured", revision.unit);
        return {
          ok: false as const,
          code: "invalid_input" as const,
          message: parsed.message,
          // Advisory only: the client offers it; the player still confirms it.
          ...(repair ? { suggestion: repair.fixed } : {}),
        };
      }
      const targetRat = targetValue(scoring);
      if (!targetRat) return { ok: false as const, code: "stale" as const, message: "Benchmark missing." };
      submittedValue = parsed.canonical;
      outcome = "scored";
      const scored = scoreValue(parsed.value, targetRat);
      points = scored.points;
      mark = scored.mark;
      errorFactor = stringifyRat(scored.errorFactor);
    }

    await tx.query(
      `update attempt_rounds set outcome=$3, submitted_value=$4, submitted_entity=$5, points=$6,
              mark=$7, error_factor=$8, request_id=$9, resolved_at=$10
       where attempt_id=$1 and ordinal=$2 and outcome is null`,
      [attempt.id, input.ordinal, outcome, submittedValue, submittedEntity, points, mark, errorFactor, input.requestId, now()],
    );
    const updated = await tx.query<AttemptRoundRow>(
      `select * from attempt_rounds where attempt_id = $1 and ordinal = $2`,
      [attempt.id, input.ordinal],
    );
    if (!updated.rows[0].outcome) {
      // Lost a race with a concurrent resolve; return the committed outcome.
      return { ok: true as const, state: await buildState(tx, attempt, puzzle) };
    }
    await tx.query(`update attempts set score = score + $2 where id = $1`, [attempt.id, points]);
    attempt.score += points;
    await recordEventTx(tx, puzzle.game_slug, "round_resolved", `${input.ordinal}:${outcome}`);

    const state = await buildState(tx, attempt, puzzle);
    return { ok: true, state };
  });
}

function stringifyRat(r: Rat): string {
  if (r.d === 1n) return r.n.toString();
  let x = r.n;
  let rem = x % r.d;
  x = x / r.d;
  let frac = "";
  let guard = 0;
  while (rem !== 0n && guard < 40) {
    rem *= 10n;
    frac += (rem / r.d).toString();
    rem = rem % r.d;
    guard++;
  }
  return frac ? `${x}.${frac}` : `${x}`;
}

function targetValue(scoring: PrivateScoring): Rat | null {
  if (scoring.type === "direct_fact") return parseDecimalToRat(scoring.value);
  if (scoring.type === "calculation") return scoring.benchmark ? parseDecimalToRat(scoring.benchmark) : null;
  return null;
}

async function puzzleOf(tx: Queryable, attempt: AttemptRow): Promise<PuzzleRow> {
  const rows = await tx.query<PuzzleRow>(
    `select id, game_slug, date::text as date, display_number, theme_tag, status, prompt_revision_ids
     from puzzles where id = $1`,
    [attempt.puzzle_id],
  );
  return rows.rows[0];
}

// ---------------------------------------------------------------------------
// Advance
// ---------------------------------------------------------------------------

export async function advanceRound(guestId: string, input: AdvanceInput): Promise<AdvanceResult> {
  const db = await getDb();
  return db.transaction(async (tx) => {
    const rows = await tx.query<AttemptRow & { game_slug: string }>(
      `select a.*, p.game_slug from attempts a join puzzles p on p.id = a.puzzle_id
       where a.id = $1 for update of a`,
      [input.attemptId],
    );
    const attempt = rows.rows[0];
    if (!attempt) return { ok: false as const, code: "not_found" as const, message: "Attempt not found." };
    if (attempt.guest_id !== guestId) {
      return { ok: false as const, code: "wrong_guest" as const, message: "This attempt belongs to another browser." };
    }
    await freezeIfExpired(tx, attempt);
    if (attempt.state === "expired") {
      return { ok: false as const, code: "expired" as const, message: "This daily's finish window ended." };
    }
    if (attempt.state === "completed") {
      // Repeated final advance returns the same recap.
      const puzzle = await puzzleOf(tx, attempt);
      return { ok: true, state: await buildState(tx, attempt, puzzle) };
    }

    const roundRows = await tx.query<AttemptRoundRow>(
      `select * from attempt_rounds where attempt_id = $1 and ordinal = $2`,
      [attempt.id, input.ordinal],
    );
    const round = roundRows.rows[0];
    if (!round || !round.outcome) {
      return { ok: false as const, code: "round_not_resolved" as const, message: "Resolve the current round first." };
    }
    if (input.ordinal !== attempt.current_ordinal) {
      // A repeated advance: never advance twice, never refresh a deadline.
      const puzzle = await puzzleOf(tx, attempt);
      return { ok: true, state: await buildState(tx, attempt, puzzle) };
    }

    const puzzle = await puzzleOf(tx, attempt);
    if (input.ordinal === 5) {
      const total = await tx.query<{ total: number }>(
        `select coalesce(sum(points),0)::int as total from attempt_rounds where attempt_id = $1`,
        [attempt.id],
      );
      await tx.query(
        `update attempts set state = 'completed', completed_at = $2, completion_date = $3, score = $4, current_ordinal = 5
         where id = $1`,
        [attempt.id, now(), puzzle.date, total.rows[0].total],
      );
      attempt.state = "completed";
      attempt.score = total.rows[0].total;
      await recordEventTx(tx, puzzle.game_slug, "completion", attempt.mode);
    } else {
      const next = input.ordinal + 1;
      await tx.query(`update attempts set current_ordinal = $2 where id = $1`, [attempt.id, next]);
      await armRound(tx, attempt.id, next, puzzle.prompt_revision_ids[next - 1]);
      attempt.current_ordinal = next;
    }

    const state = await buildState(tx, attempt, puzzle);
    return { ok: true, state };
  });
}

// ---------------------------------------------------------------------------
// Reveal / recap assembly
// ---------------------------------------------------------------------------

async function buildResolved(
  round: AttemptRoundRow,
  rev: PromptRevisionRow,
  puzzle: PuzzleRow,
  client?: Queryable,
): Promise<RoundResolved> {
  const scoring = rev.private as PrivateScoring;
  const reveal = rev.reveal as RevealRecord;
  const isTarget = rev.round_type === "target_match";
  const passed = round.outcome === "pass";
  const points = round.points ?? 0;
  const mark = (round.mark ?? "Pass") as RoundResolved["mark"];

  let guess: RoundResolved["guess"] = null;
  let entity: RoundResolved["entity"] = null;
  let dir: string | null = null;
  let gap: RoundResolved["absoluteGap"] = null;
  let closest: RoundResolved["closest"] = null;
  let targetDisplay: string | null = null;
  let benchmarkLabel: RoundResolved["reveal"]["benchmarkLabel"] = null;

  if (!passed && !isTarget && scoring.type !== "target_match") {
    const target = targetValue(scoring)!;
    const guessRat = parseDecimalToRat(round.submitted_value!)!;
    const targetStr = formatDisplay(scoring.type === "calculation" ? scoring.benchmark! : scoring.value);
    targetDisplay = targetStr;
    benchmarkLabel = scoring.type === "direct_fact" ? "Official figure" : "Worked estimate";
    guess = { display: formatDisplay(round.submitted_value!), canonical: round.submitted_value! };
    dir = guessDirection(guessRat, target) === "high" ? "high" : "low";
    const abs = cmp(guessRat, target) > 0 ? sub(guessRat, target) : sub(target, guessRat);
    gap = { display: formatDisplay(stringifyRat(abs)), unit: rev.unit };
  }
  if (!passed && isTarget && scoring.type === "target_match") {
    const target = parseDecimalToRat(scoring.target)!;
    targetDisplay = formatDisplay(scoring.target);
    const entries = await eligibleEntries(scoring.datasetId, scoring.eligibleEntryIds, client);
    const chosen = entries.find((e) => e.entry_id === round.submitted_entity?.entryId);
    if (chosen) {
      const chosenRat = parseDecimalToRat(chosen.value)!;
      entity = { label: chosen.label, valueDisplay: formatDisplay(chosen.value) };
      dir = cmp(chosenRat, target) > 0 ? "higher than target" : "lower than target";
    }
    const { best } = bestMatches(target, entries);
    const shown = best.slice(0, 3);
    closest = {
      entries: shown.map((e) => ({
        label: e.label,
        valueDisplay: formatDisplay(e.value),
        sourceTitle: e.source?.title ?? "",
        sourceUrl: e.source?.url ?? null,
      })),
      moreCount: Math.max(0, best.length - shown.length),
    };
  }

  const hint = rev.hint as { text?: string; figure?: { value: string; unit: string; scope?: string } } | null;

  return {
    ordinal: round.ordinal,
    revisionId: rev.revision_id,
    roundType: rev.round_type as RoundResolved["roundType"],
    promptText: rev.prompt_text,
    category: rev.category,
    outcome: passed ? "pass" : "scored",
    guess,
    entity,
    points,
    mark,
    direction: dir,
    absoluteGap: gap,
    closest,
    reveal: {
      benchmarkLabel,
      targetDisplay,
      unit: rev.unit,
      explanation: reveal.explanation,
      source: reveal.sourceTitle ? { title: reveal.sourceTitle, url: reveal.sourceUrl ?? null } : null,
      comparison: reveal.comparison ?? null,
      steps: scoring.type === "calculation" ? scoring.steps : reveal.steps ?? null,
    },
    percentile: null,
    hintText: hint?.text ?? null,
    hintFigure: hint?.figure ?? null,
  };
}

export async function buildRecap(
  attempt: AttemptRow,
  puzzle: PuzzleRow,
  revisionRows: PromptRevisionRow[],
  roundRows: AttemptRoundRow[],
  client?: Queryable,
): Promise<Recap> {
  const rounds: RoundResolved[] = [];
  for (const r of roundRows) {
    const rev = revisionRows.find((x) => x.revision_id === r.revision_id);
    if (!rev || !r.outcome) continue;
    rounds.push(await buildResolved(r, rev, puzzle, client));
  }
  // Community percentile per scored numeric round (only when 50+ other guesses exist).
  for (const r of rounds) {
    if (r.outcome !== "scored" || r.roundType === "target_match") continue;
    const roundRow = roundRows.find((x) => x.ordinal === r.ordinal);
    if (roundRow?.error_factor) {
      r.percentile = await buildCommunityPercentile(
        roundRow.revision_id,
        roundRow.error_factor,
        attempt.id,
        r.ordinal,
        client,
      );
    }
  }

  let closestRound: Recap["closestRound"] = null;
  const scored = rounds.filter((r) => r.outcome === "scored");
  if (scored.length > 0) {
    let best = scored[0];
    for (const r of scored) {
      const efR = roundRows.find((x) => x.ordinal === r.ordinal)?.error_factor;
      const efB = roundRows.find((x) => x.ordinal === best.ordinal)?.error_factor;
      if (efR && efB && cmp(parseDecimalToRat(efR)!, parseDecimalToRat(efB)!) < 0) best = r;
    }
    closestRound = { ordinal: best.ordinal, shortLabel: best.promptText.slice(0, 60) + (best.promptText.length > 60 ? "…" : "") };
  }

  return {
    game: puzzle.game_slug,
    puzzleDate: puzzle.date,
    displayNumber: puzzle.display_number,
    mode: attempt.mode as "daily" | "archive",
    total: attempt.score,
    maxTotal: 500,
    rounds,
    closestRound,
    nextResetIso: nextResetIso(now()),
  };
}

export async function getRecapForGuest(guestId: string, attemptId: string): Promise<{ ok: true; recap: Recap } | { ok: false; code: string; message: string }> {
  const db = await getDb();
  return db.transaction(async (tx) => {
    const rows = await tx.query<AttemptRow>(
      `select * from attempts where id = $1 and guest_id = $2`,
      [attemptId, guestId],
    );
    const attempt = rows.rows[0];
    if (!attempt) return { ok: false as const, code: "not_found", message: "Attempt not found." };
    if (attempt.state !== "completed") return { ok: false as const, code: "not_completed", message: "This attempt is not finished." };
    const puzzle = await puzzleOf(tx, attempt);
    const revisionRows = await getPromptRevisions(puzzle.prompt_revision_ids, tx);
    const rounds = await tx.query<AttemptRoundRow>(
      `select * from attempt_rounds where attempt_id = $1 order by ordinal`,
      [attempt.id],
    );
    return { ok: true, recap: await buildRecap(attempt, puzzle, revisionRows, rounds.rows, tx) };
  });
}

/** Hint content for an open round (server-supplied only). */
export async function getHint(guestId: string, attemptId: string, ordinal: number): Promise<{ ok: true; hint: unknown } | { ok: false; message: string }> {
  const db = await getDb();
  const rows = await q<{ hint: unknown; state: string }>(
    `select r.hint, a.state from attempts a
     join puzzles p on p.id = a.puzzle_id
     join prompt_revisions r on r.revision_id = p.prompt_revision_ids[$3]
     where a.id = $1 and a.guest_id = $2 and a.current_ordinal = $3`,
    [attemptId, guestId, ordinal],
  );
  const row = rows[0];
  if (!row) return { ok: false, message: "Hint not available." };
  if (row.state !== "active") return { ok: false, message: "Hint not available." };
  return { ok: true, hint: row.hint };
}

/**
 * Internal (server-only) helper for the autocomplete endpoint: which dataset
 * and eligible subset belong to an open target-match round. Never exposes
 * values or the answer key.
 */
export async function getTargetDatasetForRound(
  guestId: string,
  attemptId: string,
  ordinal: number,
): Promise<{ datasetId: string; eligibleEntryIds: string[] | null } | null> {
  const state = await getAttemptState(guestId, attemptId);
  if (!state.ok) return null;
  const s = state.state;
  if (s.state !== "active" || !s.prompt || s.prompt.ordinal !== ordinal || s.prompt.roundType !== "target_match") return null;
  const rev = await getPromptRevision(s.prompt ? (await currentRevisionId(attemptId, ordinal)) : "");
  if (!rev) return null;
  const scoring = rev.private as PrivateScoring;
  if (scoring.type !== "target_match") return null;
  return { datasetId: scoring.datasetId, eligibleEntryIds: scoring.eligibleEntryIds ?? null };
}

async function currentRevisionId(attemptId: string, ordinal: number): Promise<string> {
  const rows = await q<{ revision_id: string }>(
    `select revision_id from attempt_rounds where attempt_id = $1 and ordinal = $2`,
    [attemptId, ordinal],
  );
  return rows[0]?.revision_id ?? "";
}
