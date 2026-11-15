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

export async function computeStreaks(gameSlug: string, guestId: string): Promise<{ current: number; best: number }> {
  const [releasedDates, completedRows] = await Promise.all([
    getReleasedDates(gameSlug),
    q<{ completion_date: string }>(
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
  if (others < 50) return null;
  const closer = Number(rows[0]?.closer ?? 0);
  return Math.floor((closer / others) * 100);
}
