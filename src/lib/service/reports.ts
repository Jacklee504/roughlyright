import { randomUUID } from "node:crypto";
import { q } from "@/lib/db/client";
import { recordEvent } from "./stats";

/**
 * Content reports: private to editorial operators. Rate limiting to prevent
 * abuse without interrupting normal play is applied at the HTTP layer.
 */
export async function createContentReport(input: {
  revisionId: string;
  reason: string;
  proposedAnswer?: string | null;
  url?: string | null;
}): Promise<{ ok: true }> {
  const id = randomUUID();
  await q(
    `insert into content_reports (id, revision_id, reason, proposed_answer, url)
     values ($1,$2,$3,$4,$5)`,
    [id, input.revisionId, input.reason, input.proposedAnswer ?? null, input.url ?? null],
  );
  await recordEvent("estimation", "report", "content");
  return { ok: true };
}
