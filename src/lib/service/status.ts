import type { GameStatus } from "@/lib/dto";
import { utcToday, nextResetIso } from "@/lib/domain/calendar";
import { now } from "@/lib/domain/clock";
import { getPuzzleByDate } from "./puzzles";
import { q } from "@/lib/db/client";
import { computeStreaks } from "./stats";

/**
 * Game status: read-only. Loading never creates an attempt.
 */
export async function getGameStatus(gameSlug: string, guestId: string | null): Promise<GameStatus> {
  const today = utcToday();
  const nextReset = nextResetIso(now());
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

  const streak = guestId
    ? await computeStreaks(gameSlug, guestId)
    : { current: 0, best: 0 };

  return {
    game: gameSlug,
    date: today,
    nextResetIso: nextReset,
    puzzleAvailable: !!puzzle,
    puzzleNumber: puzzle?.display_number ?? null,
    themeTag: puzzle?.theme_tag ?? null,
    attempt,
    streak,
  };
}
