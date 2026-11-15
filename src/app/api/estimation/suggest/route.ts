import { NextRequest, NextResponse } from "next/server";
import { getGuestId } from "@/lib/http/session";
import { rateLimit } from "@/lib/http/ratelimit";
import { q } from "@/lib/db/client";
import { normalizeKey } from "@/lib/domain/text";
import { getTargetDatasetForRound } from "@/lib/service/attempts";
import { isUuid } from "@/lib/http/validate";
import { fuzzyEntityMatches } from "@/lib/domain/autocorrect";

export const dynamic = "force-dynamic";

/**
 * Target-match prefix suggestions. Served only after three normalised
 * characters; up to eight eligible labels, sorted by label, independent of
 * target distance. Autocomplete never returns measurement values or answers.
 */
export async function GET(req: NextRequest) {
  const guestId = await getGuestId();
  if (!guestId) return NextResponse.json({ ok: true, suggestions: [] });
  const url = new URL(req.url);
  const attemptId = url.searchParams.get("attemptId") ?? "";
  const ordinal = Number(url.searchParams.get("ordinal") ?? "0");
  const raw = url.searchParams.get("q") ?? "";
  if (!isUuid(attemptId) || !Number.isInteger(ordinal) || ordinal < 1) {
    return NextResponse.json({ ok: false, code: "bad_request", message: "Missing attempt or ordinal." }, { status: 400 });
  }
  if (!rateLimit(`suggest:${guestId}`, 40, 60_000)) {
    return NextResponse.json({ ok: false, code: "rate_limited", message: "Too many lookups — slow down for a moment." }, { status: 429 });
  }
  const norm = normalizeKey(raw);
  if (norm.length < 3) return NextResponse.json({ ok: true, suggestions: [] });

  const dataset = await getTargetDatasetForRound(guestId, attemptId, ordinal);
  if (!dataset) return NextResponse.json({ ok: true, suggestions: [] });

  const rows = await q<{ label: string; disambiguator: string | null }>(
    `select e.label, e.disambiguator
     from target_lookup l
     join target_entries e on e.dataset_id = l.dataset_id and e.entry_id = l.entry_id
     where l.dataset_id = $1 and l.norm_key like $2 || '%'
       and ($3::text[] is null or e.entry_id = any($3::text[]))
     order by e.label asc
     limit 8`,
    [dataset.datasetId, norm, dataset.eligibleEntryIds],
  );

  if (rows.length > 0) {
    return NextResponse.json({
      ok: true,
      suggestions: rows.map((r) => ({ label: r.label, disambiguator: r.disambiguator })),
    });
  }

  // Prefix search found nothing: fall back to fuzzy typo matching over the
  // eligible labels (labels only — never values or answers).
  const labels = await q<{ label: string; disambiguator: string | null }>(
    `select distinct e.label, e.disambiguator
     from target_entries e
     where e.dataset_id = $1
       and ($2::text[] is null or e.entry_id = any($2::text[]))`,
    [dataset.datasetId, dataset.eligibleEntryIds],
  );
  const hits = fuzzyEntityMatches(
    raw,
    labels.map((r) => ({ display: r.disambiguator ? `${r.label} (${r.disambiguator})` : r.label, entryKey: r.label })),
    normalizeKey,
  ).slice(0, 8);
  return NextResponse.json({
    ok: true,
    suggestions: hits.map((h) => {
      const label = h.candidate.entryKey;
      const row = labels.find((r) => r.label === label);
      return { label, disambiguator: row?.disambiguator ?? null, fuzzy: true as const };
    }),
  });
}
