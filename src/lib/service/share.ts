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
  /** The viewer's own run used for comparison (labelled when modes differ). */
  viewerRun: { mode: "daily" | "archive"; total: number } | null;
  /** Cosmetic supporter badge (only when the owner is a supporter). */
  ownerSupporter: boolean;
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

/**
 * Public share view. Comparison unlocks only when the owner enabled it and the
 * viewer has completed the same puzzle themselves (either mode; a daily run is
 * preferred). The third parameter is accepted for older callers and ignored:
 * the viewer's completion is always looked up server-side.
 */
export async function getSharePayload(
  token: string,
  viewerGuestId: string | null,
  _ignored?: string | null,
): Promise<{ found: true; payload: SharePayload; attemptId: string; puzzleId: string; ownerGuestId: string } | { found: false }> {
  if (typeof token !== "string" || !/^[A-Za-z0-9_-]{16,64}$/.test(token)) return { found: false };
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
    owner_guest: string;
    owner_tier: string;
    marks: { ordinal: number; mark: string }[];
  }>(
    `select s.token, s.comparison, a.id as attempt_id, p.id as puzzle_id, p.game_slug,
            p.date::text as date, p.display_number, a.mode, a.score,
            a.guest_id as owner_guest, coalesce(g.tier, 'free') as owner_tier,
            coalesce(
              (select json_agg(json_build_object('ordinal', r.ordinal, 'mark', r.mark) order by r.ordinal)
               from attempt_rounds r where r.attempt_id = a.id and r.outcome is not null),
              '[]'::json
            ) as marks
     from share_results s
     join attempts a on a.id = s.attempt_id
     join puzzles p on p.id = a.puzzle_id
     left join guests g on g.id = a.guest_id
     where s.token = $1 and s.revoked_at is null and a.state = 'completed'`,
    [token],
  );
  const row = rows.rows[0];
  if (!row) return { found: false };

  let comparison: SharePayload["comparison"] = null;
  let viewerRun: SharePayload["viewerRun"] = null;
  if (row.comparison && viewerGuestId) {
    // The viewer's own completed run of the same puzzle; daily preferred.
    const runs = await db.query<{ id: string; mode: string; score: number }>(
      `select id, mode, score from attempts
       where puzzle_id = $1 and guest_id = $2 and state = 'completed'
       order by (mode = 'daily') desc limit 1`,
      [row.puzzle_id, viewerGuestId],
    );
    const run = runs.rows[0];
    const viewerRows = run
      ? await db.query<{ ordinal: number; points: number; mark: string }>(
          `select ordinal, points, mark from attempt_rounds where attempt_id = $1 and outcome is not null`,
          [run.id],
        )
      : { rows: [] as { ordinal: number; points: number; mark: string }[] };
    if (run && viewerRows.rows.length > 0) {
      viewerRun = { mode: run.mode as "daily" | "archive", total: run.score };
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
    ownerGuestId: row.owner_guest,
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
      viewerRun,
      ownerSupporter: row.owner_tier === "supporter",
    },
  };
}

/** The guest's live (unrevoked) share links, for the privacy page. */
export async function listShares(guestId: string): Promise<{ token: string; displayNumber: number; puzzleDate: string; mode: string; comparison: boolean; createdAt: string }[]> {
  const db = await getDb();
  const rows = await db.query<{ token: string; display_number: number; date: string; mode: string; comparison: boolean; created_at: string }>(
    `select s.token, p.display_number, p.date::text as date, a.mode, s.comparison, s.created_at::text as created_at
     from share_results s join attempts a on a.id = s.attempt_id join puzzles p on p.id = a.puzzle_id
     where a.guest_id = $1 and s.revoked_at is null
     order by s.created_at desc`,
    [guestId],
  );
  return rows.rows.map((r) => ({
    token: r.token,
    displayNumber: r.display_number,
    puzzleDate: r.date,
    mode: r.mode,
    comparison: r.comparison,
    createdAt: r.created_at,
  }));
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
