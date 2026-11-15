import { getDb, type Queryable } from "@/lib/db/client";

export type PuzzleRow = {
  id: string;
  game_slug: string;
  date: string;
  display_number: number;
  theme_tag: string | null;
  status: string;
  prompt_revision_ids: string[];
};

export type PromptRevisionRow = {
  revision_id: string;
  prompt_id: string;
  round_type: string;
  category: string;
  prompt_text: string;
  scope: string | null;
  unit: string;
  count_mode: boolean;
  hint: unknown;
  private: unknown;
  reveal: unknown;
  quality: string;
  status: string;
};

export async function getPuzzleByDate(gameSlug: string, date: string, client?: Queryable): Promise<PuzzleRow | null> {
  const c = client ?? (await getDb());
  const rows = await c.query<PuzzleRow>(
    `select id, game_slug, date::text as date, display_number, theme_tag, status, prompt_revision_ids
     from puzzles where game_slug = $1 and date = $2 and status = 'live'`,
    [gameSlug, date],
  );
  return rows.rows[0] ?? null;
}

export async function getPromptRevisions(revisionIds: string[], client?: Queryable): Promise<PromptRevisionRow[]> {
  if (revisionIds.length === 0) return [];
  const c = client ?? (await getDb());
  const rows = await c.query<PromptRevisionRow>(
    `select revision_id, prompt_id, round_type, category, prompt_text, scope, unit, count_mode,
            hint, private, reveal, quality, status
     from prompt_revisions
     where revision_id = any($1::uuid[])`,
    [revisionIds],
  );
  // Restore the puzzle's prompt order.
  const byId = new Map(rows.rows.map((r) => [r.revision_id, r]));
  return revisionIds.map((id) => byId.get(id)).filter((r): r is PromptRevisionRow => !!r);
}

export async function getReleasedDates(gameSlug: string, client?: Queryable): Promise<string[]> {
  const c = client ?? (await getDb());
  const rows = await c.query<{ date: string }>(
    `select date::text as date from puzzles where game_slug = $1 and status = 'live' order by date asc`,
    [gameSlug],
  );
  return rows.rows.map((r) => r.date);
}

export async function getPromptRevision(revisionId: string, client?: Queryable): Promise<PromptRevisionRow | null> {
  const c = client ?? (await getDb());
  const rows = await c.query<PromptRevisionRow>(
    `select revision_id, prompt_id, round_type, category, prompt_text, scope, unit, count_mode,
            hint, private, reveal, quality, status
     from prompt_revisions where revision_id = $1`,
    [revisionId],
  );
  return rows.rows[0] ?? null;
}
