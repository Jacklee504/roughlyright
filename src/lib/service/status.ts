import type { GameStatus } from "@/lib/dto";
import { utcToday, nextResetIso, datePlusDays } from "@/lib/domain/calendar";
import { now } from "@/lib/domain/clock";
import { getPuzzleByDate } from "./puzzles";
import { q } from "@/lib/db/client";
import { computeStreaks } from "./stats";

/**
 * Game status: read-only. Loading never creates an attempt.
 */
export async function getGameStatus(gameSlug: string, guestId: string | null): Promise<GameStatus> {
  const today = utcToday();
  const nowD = now();
  const nextReset = nextResetIso(nowD);
  const puzzle = await getPuzzleByDate(gameSlug, today);

  let attempt: GameStatus["attempt"] = null;
  if (guestId && puzzle) {
    const rows = await q<{ id: string; state: string; score: number; mode: string }>(
      `select id, state, score, mode from attempts where guest_id = $1 and puzzle_id = $2 and mode = 'daily'`,
      [guestId, puzzle.id],
    );
    const row = rows[0];
    attempt = row
      ? { exists: true, state: row.state as "active" | "completed" | "expired", score: row.score, mode: row.mode }
      : { exists: false, state: "none", score: 0, mode: "daily" };
  }

  // Yesterday's ranked run, still open inside its finish window (00:00-00:30
  // UTC): the home page offers "finish yesterday's" first.
  let pending: GameStatus["pending"] = null;
  let dailiesPlayed = 0;
  if (guestId) {
    const yesterday = datePlusDays(today, -1);
    const rows = await q<{ date: string; display_number: number; daily_expiry: Date; current_ordinal: number }>(
      `select p.date::text as date, p.display_number, a.daily_expiry, a.current_ordinal
       from attempts a join puzzles p on p.id = a.puzzle_id
       where a.guest_id = $1 and a.mode = 'daily' and a.state = 'active' and p.game_slug = $2 and p.date = $3
         and a.daily_expiry > $4`,
      [guestId, gameSlug, yesterday, nowD],
    );
    const r = rows[0];
    if (r) {
      pending = {
        date: r.date,
        puzzleNumber: r.display_number,
        expiresAt: new Date(r.daily_expiry).toISOString(),
        ordinal: r.current_ordinal,
      };
    }
    const played = await q<{ n: string }>(
      `select count(*)::text as n from attempts a join puzzles p on p.id = a.puzzle_id
       where a.guest_id = $1 and p.game_slug = $2 and a.mode = 'daily' and a.state = 'completed'`,
      [guestId, gameSlug],
    );
    dailiesPlayed = Number(played[0]?.n ?? 0);
  }

  const streak = guestId ? await computeStreaks(gameSlug, guestId) : { current: 0, best: 0 };

  return {
    game: gameSlug,
    date: today,
    nextResetIso: nextReset,
    puzzleAvailable: !!puzzle,
    puzzleNumber: puzzle?.display_number ?? null,
    themeTag: puzzle?.theme_tag ?? null,
    attempt,
    streak,
    pending,
    dailiesPlayed,
  };
}
