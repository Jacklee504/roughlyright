import { randomBytes } from "node:crypto";
import { getDb } from "@/lib/db/client";
import type { Mark } from "@/lib/dto";

/**
 * Share results: opaque, unguessable public tokens. A link is a view link —
 * possession grants access to the intended share view only. The payload is
 * spoiler-free: game, puzzle number, total and five marks with text labels.
 * Prompts, answers, guesses and solution facts never appear.
 */

export type SharePayload = {
  game: string;
  displayNumber: number;
  puzzleDate: string;
  mode: "daily" | "archive";
  total: number;
  maxTotal: number;
  marks: { ordinal: number; mark: Mark }[];
  comparisonEnabled: boolean;
  comparison: { ordinal: number; owner: { points: number; mark: Mark }; viewer: { points: number; mark: Mark } }[] | null;
};

export async function createShare(guestId: string, attemptId: string, comparison: boolean): Promise<{ ok: true; token: string } | { ok: false; message: string }> {
  const db = await getDb();
  const rows = await db.query<{ id: string; state: string; game_slug: string }>(
    `select a.id, a.state, p.game_slug from attempts a join puzzles p on p.id = a.puzzle_id
     where a.id = $1 and a.guest_id = $2`,
    [attemptId, guestId],
  );
  const attempt = rows.rows[0];
  if (!attempt) return { ok: false, message: "Attempt not found." };
  if (attempt.state !== "completed") return { ok: false, message: "Finish the daily before sharing your result." };

  const existing = await db.query<{ token: string }>(
    `select token from share_results where attempt_id = $1 and revoked_at is null and comparison = $2 order by created_at desc limit 1`,
    [attemptId, comparison],
  );
  if (existing.rows[0]) return { ok: true, token: existing.rows[0].token };

  const token = randomBytes(24).toString("base64url");
  await db.query(
    `insert into share_results (token, attempt_id, comparison) values ($1,$2,$3)`,
    [token, attemptId, comparison],
  );
  await recordShareEvent(attempt.game_slug);
  return { ok: true, token };
}

export async function revokeShare(guestId: string, token: string): Promise<{ ok: boolean }> {
  const db = await getDb();
  const res = await db.query<{ id: string }>(
    `update share_results s set revoked_at = now()
     from attempts a
     where s.attempt_id = a.id and s.token = $1 and a.guest_id = $2 and s.revoked_at is null
     returning a.id`,
    [token, guestId],
  );
  return { ok: res.rows.length > 0 };
}

export async function getSharePayload(
  token: string,
  viewerGuestId: string | null,
  viewerCompletedPuzzleId: string | null,
): Promise<{ found: true; payload: SharePayload; attemptId: string; puzzleId: string } | { found: false }> {
  const db = await getDb();
  const rows = await db.query<{
    token: string;
    comparison: boolean;
    attempt_id: string;
    puzzle_id: string;
    game_slug: string;
    date: string;
    display_number: number;
    mode: string;
    score: number;
    marks: { ordinal: number; mark: string }[];
  }>(
    `select s.token, s.comparison, a.id as attempt_id, p.id as puzzle_id, p.game_slug,
            p.date::text as date, p.display_number, a.mode, a.score,
            coalesce(
              (select json_agg(json_build_object('ordinal', r.ordinal, 'mark', r.mark) order by r.ordinal)
               from attempt_rounds r where r.attempt_id = a.id and r.outcome is not null),
              '[]'::json
            ) as marks
     from share_results s
     join attempts a on a.id = s.attempt_id
     join puzzles p on p.id = a.puzzle_id
     where s.token = $1 and s.revoked_at is null and a.state = 'completed'`,
    [token],
  );
  const row = rows.rows[0];
  if (!row) return { found: false };

  let comparison: SharePayload["comparison"] = null;
  if (row.comparison && viewerCompletedPuzzleId && viewerCompletedPuzzleId === row.puzzle_id) {
    const viewerRows = await db.query<{ ordinal: number; points: number; mark: string }>(
      `select r.ordinal, r.points, r.mark from attempt_rounds r
       join attempts a on a.id = r.attempt_id
       where a.puzzle_id = $1 and a.guest_id = $2 and a.state = 'completed' and r.outcome is not null`,
      [row.puzzle_id, viewerGuestId],
    );
    if (viewerRows.rows.length > 0) {
      const ownerRows = await db.query<{ ordinal: number; points: number; mark: string }>(
        `select r.ordinal, r.points, r.mark from attempt_rounds r where r.attempt_id = $1 and r.outcome is not null`,
        [row.attempt_id],
      );
      comparison = row.marks.map((m) => {
        const owner = ownerRows.rows.find((v) => v.ordinal === m.ordinal);
        const mine = viewerRows.rows.find((v) => v.ordinal === m.ordinal);
        return {
          ordinal: m.ordinal,
          owner: { points: owner?.points ?? 0, mark: (owner?.mark ?? "Pass") as Mark },
          viewer: { points: mine?.points ?? 0, mark: (mine?.mark ?? "Pass") as Mark },
        };
      });
    }
  }

  return {
    found: true,
    attemptId: row.attempt_id,
    puzzleId: row.puzzle_id,
    payload: {
      game: row.game_slug,
      displayNumber: row.display_number,
      puzzleDate: row.date,
      mode: row.mode as "daily" | "archive",
      total: row.score,
      maxTotal: 500,
      marks: row.marks.map((m) => ({ ordinal: m.ordinal, mark: m.mark as Mark })),
      comparisonEnabled: row.comparison,
      comparison,
    },
  };
}

async function recordShareEvent(game: string): Promise<void> {
  const db = await getDb();
  await db.query(
    `insert into site_events (day, game_slug, event, detail, count)
     values (current_date, $1, 'share', '', 1)
     on conflict (day, game_slug, event, detail) do update set count = site_events.count + 1`,
    [game],
  );
}
