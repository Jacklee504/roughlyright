import { q } from "@/lib/db/client";

/**
 * Privacy self-service (Q25): guests can export or delete their own play data.
 * Exports contain only the guest's own submissions and share links — never
 * content reports, abuse counters, or answer-key material. Deletion removes
 * attempts, rounds and share links, then the guest row itself.
 */

type ExportRound = {
  ordinal: number;
  roundType: string;
  category: string | null;
  prompt: string | null;
  outcome: string | null;
  submittedValue: string | null;
  submittedEntity: unknown;
  points: number | null;
  mark: string | null;
  resolvedAt: string | null;
};

type ExportAttempt = {
  puzzleDate: string;
  displayNumber: number;
  mode: string;
  state: string;
  startedAt: string;
  completedAt: string | null;
  completionDate: string | null;
  score: number;
  rounds: ExportRound[];
};

export type PrivacyExport = {
  exportedAt: string;
  guestIdPrefix: string;
  createdAt: string;
  attempts: ExportAttempt[];
  shareTokens: { tokenPrefix: string; createdAt: string; revoked: boolean }[];
  tier: string;
  purchases: { provider: string; status: string; createdAt: string; completedAt: string | null }[];
};

/** First 8 characters only: exports identify without enabling impersonation. */
const prefix = (id: string | null): string => (id ? id.slice(0, 8) : "");

export async function exportGuestData(guestId: string): Promise<PrivacyExport | null> {
  const rows = await q<{
    id: string;
    created_at: string;
    attempt_id: string | null;
    puzzle_date: string | null;
    display_number: number | null;
    mode: string | null;
    state: string | null;
    started_at: string | null;
    completed_at: string | null;
    completion_date: string | null;
    score: number | null;
  }>(
    `select g.id, g.created_at::text as created_at,
            a.id as attempt_id, p.date::text as puzzle_date, p.display_number,
            a.mode, a.state, a.started_at::text as started_at,
            a.completed_at::text as completed_at, a.completion_date::text as completion_date, a.score
     from guests g
     left join attempts a on a.guest_id = g.id
     left join puzzles p on p.id = a.puzzle_id
     where g.id = $1
     order by a.started_at asc nulls first`,
    [guestId],
  );
  const guest = rows[0];
  if (!guest) return null;

  const attemptIds = rows.map((r) => r.attempt_id).filter((x): x is string => x != null);
  const roundsByAttempt = new Map<string, ExportRound[]>();
  if (attemptIds.length > 0) {
    const roundRows = await q<{
      attempt_id: string;
      ordinal: number;
      round_type: string;
      category: string | null;
      prompt_text: string | null;
      outcome: string | null;
      submitted_value: string | null;
      submitted_entity: unknown;
      points: number | null;
      mark: string | null;
      resolved_at: string | null;
    }>(
      `select r.attempt_id, r.ordinal, rev.round_type, rev.category, rev.prompt_text,
              r.outcome, r.submitted_value, r.submitted_entity, r.points, r.mark,
              r.resolved_at::text as resolved_at
       from attempt_rounds r
       join prompt_revisions rev on rev.revision_id = r.revision_id
       where r.attempt_id = any($1::uuid[])
       order by r.attempt_id, r.ordinal`,
      [attemptIds],
    );
    for (const r of roundRows) {
      const list = roundsByAttempt.get(r.attempt_id) ?? [];
      list.push({
        ordinal: r.ordinal,
        roundType: r.round_type,
        category: r.category,
        prompt: r.prompt_text,
        outcome: r.outcome,
        submittedValue: r.submitted_value,
        submittedEntity: r.submitted_entity,
        points: r.points,
        mark: r.mark,
        resolvedAt: r.resolved_at,
      });
      roundsByAttempt.set(r.attempt_id, list);
    }
  }

  const shares = await q<{ token: string; created_at: string; revoked_at: string | null }>(
    `select s.token, s.created_at::text as created_at, s.revoked_at::text as revoked_at
     from share_results s
     join attempts a on a.id = s.attempt_id
     where a.guest_id = $1
     order by s.created_at asc`,
    [guestId],
  );

  const tierRows = await q<{ tier: string }>(`select tier from guests where id = $1`, [guestId]);
  const purchases = await q<{ provider: string; status: string; created_at: string; completed_at: string | null }>(
    `select provider, status, created_at::text as created_at, completed_at::text as completed_at
     from purchases where guest_id = $1 order by created_at asc`,
    [guestId],
  );

  return {
    tier: tierRows[0]?.tier ?? "free",
    purchases: purchases.map((p) => ({ provider: p.provider, status: p.status, createdAt: p.created_at, completedAt: p.completed_at })),
    exportedAt: new Date().toISOString(),
    guestIdPrefix: prefix(guestId),
    createdAt: guest.created_at,
    attempts: rows
      .filter((r) => r.attempt_id != null)
      .map((r) => ({
        puzzleDate: r.puzzle_date ?? "",
        displayNumber: r.display_number ?? 0,
        mode: r.mode ?? "",
        state: r.state ?? "",
        startedAt: r.started_at ?? "",
        completedAt: r.completed_at,
        completionDate: r.completion_date,
        score: r.score ?? 0,
        rounds: roundsByAttempt.get(r.attempt_id!) ?? [],
      })),
    shareTokens: shares.map((s) => ({
      tokenPrefix: prefix(s.token),
      createdAt: s.created_at,
      revoked: s.revoked_at != null,
    })),
  };
}

/**
 * Deletes the guest's play data and the guest row. Content reports and abuse
 * counters are deliberately untouched (they are not guest-linked). Returns the
 * number of deleted attempts for the confirmation message.
 */
export async function deleteGuestData(guestId: string): Promise<{ ok: true; attempts: number; shares: number } | { ok: false; message: string }> {
  const { getDb } = await import("@/lib/db/client");
  const db = await getDb();
  const result = await db.transaction(async (tx) => {
    const counts = await tx.query<{ attempts: string; shares: string }>(
      `select (select count(*) from attempts where guest_id = $1)::text as attempts,
              (select count(*) from share_results s join attempts a on a.id = s.attempt_id where a.guest_id = $1)::text as shares`,
      [guestId],
    );
    await tx.query(
      `delete from attempt_rounds r using attempts a
       where r.attempt_id = a.id and a.guest_id = $1`,
      [guestId],
    );
    await tx.query(
      `delete from share_results s using attempts a
       where s.attempt_id = a.id and a.guest_id = $1`,
      [guestId],
    );
    await tx.query(`delete from attempts where guest_id = $1`, [guestId]);
    // Purchases are unlinked, not deleted: the payment provider keeps its own
    // records, and the restore code still re-grants the supporter tier.
    await tx.query(`update purchases set guest_id = null where guest_id = $1`, [guestId]);
    await tx.query(`delete from guests where id = $1`, [guestId]);
    return counts.rows[0];
  });
  return {
    ok: true,
    attempts: Number(result.attempts),
    shares: Number(result.shares),
  };
}
