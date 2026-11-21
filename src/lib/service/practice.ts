import { getDb, type Queryable } from "@/lib/db/client";
import { utcToday } from "@/lib/domain/calendar";
import { now } from "@/lib/domain/clock";
import type { PromptPublic, RoundResolved } from "@/lib/dto";
import { getPromptRevision, type PromptRevisionRow, type PuzzleRow } from "./puzzles";
import { buildResolved, scoreSubmission, type AttemptRoundRow } from "./attempts";

/**
 * Practice mode (supporter perk): endless single rounds drawn from puzzles
 * released before today, scored with the exact daily contract but never
 * recorded. Nothing here writes to the database, so practice can never touch
 * streaks, stats, percentiles or the archive.
 *
 * A prompt is practice-eligible only if it belongs to a released puzzle dated
 * before today and to no puzzle dated today or later, so practice can never
 * leak today's (or a future) answer.
 */

export type PracticePrompt = PromptPublic & { revisionId: string; puzzleNumber: number; puzzleDate: string };

const ELIGIBLE_SQL = `
  select pr.revision_id
  from prompt_revisions pr
  where exists (
      select 1 from puzzles p
      where p.status = 'live' and p.game_slug = $1 and p.date < $2 and pr.revision_id = any(p.prompt_revision_ids))
    and not exists (
      select 1 from puzzles p
      where p.game_slug = $1 and p.date >= $2 and pr.revision_id = any(p.prompt_revision_ids))`;

export async function isPracticeEligible(revisionId: string, game = "estimation", client?: Queryable): Promise<boolean> {
  const c = client ?? (await getDb());
  const rows = await c.query<{ revision_id: string }>(`${ELIGIBLE_SQL} and pr.revision_id = $3`, [game, utcToday(), revisionId]);
  return rows.rows.length > 0;
}

export async function nextPracticePrompt(
  exclude: string[],
  roundType: string | null,
  game = "estimation",
): Promise<PracticePrompt | null> {
  const db = await getDb();
  const safeExclude = exclude.filter((x) => /^[0-9a-f-]{36}$/i.test(x)).slice(0, 200);
  const rows = await db.query<{ revision_id: string }>(
    `${ELIGIBLE_SQL}
       and not (pr.revision_id = any($3::uuid[]))
       and ($4::text is null or pr.round_type = $4)
     order by random() limit 1`,
    [game, utcToday(), safeExclude, roundType],
  );
  const id = rows.rows[0]?.revision_id;
  if (!id) return null;
  const rev = await getPromptRevision(id);
  if (!rev) return null;
  const origin = await db.query<{ display_number: number; date: string }>(
    `select display_number, date::text as date from puzzles
     where game_slug = $1 and $2::uuid = any(prompt_revision_ids) order by date asc limit 1`,
    [game, id],
  );
  return {
    ...toPublic(rev),
    revisionId: rev.revision_id,
    puzzleNumber: origin.rows[0]?.display_number ?? 0,
    puzzleDate: origin.rows[0]?.date ?? "",
  };
}

function toPublic(rev: PromptRevisionRow): PromptPublic {
  return {
    ordinal: 1,
    roundType: rev.round_type as PromptPublic["roundType"],
    category: rev.category,
    prompt: rev.prompt_text,
    scope: rev.scope,
    unit: rev.unit,
    countMode: rev.count_mode,
    hintAvailable: rev.hint != null && rev.round_type !== "target_match",
  };
}

export async function resolvePractice(
  revisionId: string,
  input: { pass: boolean; guess?: string; entity?: string },
): Promise<{ ok: true; resolved: RoundResolved } | { ok: false; code: string; message: string; suggestion?: string }> {
  const db = await getDb();
  if (!(await isPracticeEligible(revisionId, "estimation", db))) {
    return { ok: false, code: "not_found", message: "That practice round isn't available." };
  }
  const rev = await getPromptRevision(revisionId, db);
  if (!rev) return { ok: false, code: "not_found", message: "That practice round isn't available." };
  const sub = await scoreSubmission(db, rev, input);
  if (!sub.ok) return { ok: false, code: sub.code, message: sub.message, ...(sub.suggestion ? { suggestion: sub.suggestion } : {}) };
  const round: AttemptRoundRow = {
    attempt_id: "00000000-0000-0000-0000-000000000000",
    ordinal: 1,
    revision_id: rev.revision_id,
    opened_at: now(),
    deadline: null,
    outcome: sub.outcome,
    submitted_value: sub.submittedValue,
    submitted_entity: sub.submittedEntity,
    points: sub.points,
    mark: sub.mark,
    error_factor: sub.errorFactor,
    request_id: null,
    resolved_at: now(),
  };
  const puzzleStub = { id: "", game_slug: "estimation", date: "", display_number: 0, theme_tag: null, status: "live", prompt_revision_ids: [] } as PuzzleRow;
  return { ok: true, resolved: await buildResolved(round, rev, puzzleStub, db) };
}

export async function practiceHint(revisionId: string): Promise<unknown | null> {
  if (!(await isPracticeEligible(revisionId))) return null;
  const rev = await getPromptRevision(revisionId);
  if (!rev || rev.round_type === "target_match") return null;
  return rev.hint ?? null;
}

export async function practiceDataset(revisionId: string): Promise<{ datasetId: string; eligibleEntryIds: string[] | null } | null> {
  if (!(await isPracticeEligible(revisionId))) return null;
  const rev = await getPromptRevision(revisionId);
  const scoring = rev?.private as { type?: string; datasetId?: string; eligibleEntryIds?: string[] | null } | undefined;
  if (!rev || rev.round_type !== "target_match" || scoring?.type !== "target_match" || !scoring.datasetId) return null;
  return { datasetId: scoring.datasetId, eligibleEntryIds: scoring.eligibleEntryIds ?? null };
}
