import { q, type Queryable } from "@/lib/db/client";
import { utcToday } from "@/lib/domain/calendar";
import { now } from "@/lib/domain/clock";
import { getReleasedDates } from "./puzzles";
import { currentStreak, bestStreak } from "@/lib/domain/calendar";

/** Aggregated site events only — never guest IDs, never raw invalid entries. */
export async function recordEvent(game: string, event: string, detail: string | null): Promise<void> {
  const day = utcToday();
  await q(
    `insert into site_events (day, game_slug, event, detail, count) values ($1,$2,$3,$4,1)
     on conflict (day, game_slug, event, detail) do update set count = site_events.count + 1`,
    [day, game, event, detail],
  );
}

export async function computeStreaks(gameSlug: string, guestId: string, client?: Queryable): Promise<{ current: number; best: number }> {
  // When called inside a transaction (e.g. recap build), every query must go
  // through the same client — PGlite has a single connection and a stray
  // top-level query would deadlock it.
  const run = async <T>(sql: string, params: unknown[]): Promise<T[]> => {
    if (client) return (await client.query<T>(sql, params)).rows;
    return q<T>(sql, params);
  };
  const [releasedDates, completedRows] = await Promise.all([
    getReleasedDates(gameSlug, client),
    run<{ completion_date: string }>(
      `select distinct completion_date::text as completion_date
       from attempts
       where guest_id = $1 and mode = 'daily' and state = 'completed' and completion_date is not null`,
      [guestId],
    ),
  ]);
  const completed = new Set(completedRows.map((r) => r.completion_date));
  const today = utcToday();
  return {
    current: currentStreak(releasedDates, completed, today),
    best: bestStreak(releasedDates, completed),
  };
}

/**
 * Community closeness percentile for one prompt revision.
 * Shown only once at least 50 non-pass guesses exist from completed ranked
 * dailies, excluding the viewer's own round. Points never depend on the crowd.
 */
export async function buildCommunityPercentile(
  revisionId: string,
  viewerErrorFactor: string,
  viewerAttemptId: string,
  viewerOrdinal: number,
  client?: Queryable,
): Promise<number | null> {
  const sql = `select count(*)::text as others,
            count(*) filter (where r.error_factor::numeric > $2::numeric)::text as closer
     from attempt_rounds r
     join attempts a on a.id = r.attempt_id
     where r.revision_id = $1 and r.outcome = 'scored'
       and a.mode = 'daily' and a.state = 'completed'
       and not (a.id = $3 and r.ordinal = $4)`;
  const rows = client
    ? (await client.query<{ others: string; closer: string }>(sql, [revisionId, viewerErrorFactor, viewerAttemptId, viewerOrdinal])).rows
    : await q<{ others: string; closer: string }>(sql, [revisionId, viewerErrorFactor, viewerAttemptId, viewerOrdinal]);
  const others = Number(rows[0]?.others ?? 0);
  // Contract: the percentile is shown only once 50+ other real guesses exist.
  // (An earlier build synthesised a fake figure below that threshold; it
  // has been removed. No data means no percentile.)
  if (others < 50) return null;
  const closer = Number(rows[0]?.closer ?? 0);
  return Math.floor((closer / others) * 100);
}

export type Calibration = {
  /** Geometric-mean miss factor over the window (1 = perfect), e.g. 1.6 means "typically 1.6x off". */
  typicalMiss: number;
  /** Same measure for the previous window, for a trend arrow (null if not enough data). */
  previousMiss: number | null;
  rounds: number;
  /** Share of scored rounds in the window that landed Close or Exact. */
  closeRate: number;
};

/**
 * Own-data calibration: how far off a guest's scored daily guesses typically
 * are, as a geometric mean of error factors over their last `windowDays`
 * completed dailies, compared with the window before. Passes are excluded.
 */
export async function computeCalibration(guestId: string, windowDays = 7, client?: Queryable): Promise<Calibration | null> {
  const sql = `with days as (
       select a.id, row_number() over (order by p.date desc) as rn
       from attempts a join puzzles p on p.id = a.puzzle_id
       where a.guest_id = $1 and a.mode = 'daily' and a.state = 'completed'
     )
     select d.rn::int as rn, r.error_factor, r.mark
     from days d join attempt_rounds r on r.attempt_id = d.id
     where r.outcome = 'scored' and r.error_factor is not null and d.rn <= $2`;
  const params = [guestId, windowDays * 2];
  const rows = client
    ? (await client.query<{ rn: number; error_factor: string; mark: string }>(sql, params)).rows
    : await q<{ rn: number; error_factor: string; mark: string }>(sql, params);
  const current = rows.filter((r) => r.rn <= windowDays);
  const previous = rows.filter((r) => r.rn > windowDays);
  if (current.length === 0) return null;
  const geo = (list: { error_factor: string }[]) =>
    Math.exp(list.reduce((s, r) => s + Math.log(Math.max(1, Number(r.error_factor) || 1)), 0) / list.length);
  return {
    typicalMiss: geo(current),
    previousMiss: previous.length >= 5 ? geo(previous) : null,
    rounds: current.length,
    closeRate: current.filter((r) => r.mark === "Close" || r.mark === "Exact").length / current.length,
  };
}
