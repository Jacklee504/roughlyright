import { NextRequest, NextResponse } from "next/server";
import { getGuestId } from "@/lib/http/session";
import { rateLimit, rateLimitNetwork } from "@/lib/http/ratelimit";
import { q } from "@/lib/db/client";
import { normalizeKey } from "@/lib/domain/text";
import { getTargetDatasetForRound } from "@/lib/service/attempts";
import { isUuid } from "@/lib/http/validate";
import { getEntitlements } from "@/lib/service/tiers";
import { practiceDataset } from "@/lib/service/practice";

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
  const revisionId = url.searchParams.get("revisionId") ?? "";
  const ordinal = Number(url.searchParams.get("ordinal") ?? "0");
  const raw = (url.searchParams.get("q") ?? "").slice(0, 64);
  const practice = isUuid(revisionId) && !attemptId;
  const browse = !practice && url.searchParams.get("browse") === "1";
  if (!practice && (!isUuid(attemptId) || !Number.isInteger(ordinal) || ordinal < 1)) {
    return NextResponse.json({ ok: false, code: "bad_request", message: "Missing attempt or ordinal." }, { status: 400 });
  }
  if (!rateLimit(`suggest:${guestId}`, 40, 60_000)) {
    return NextResponse.json({ ok: false, code: "rate_limited", message: "Too many lookups — slow down for a moment." }, { status: 429 });
  }
  // Q26: coarse hashed network-key limit alongside the per-guest one.
  if (!(await rateLimitNetwork(req, "suggest-net", 600))) {
    return NextResponse.json({ ok: false, code: "rate_limited", message: "Too many requests from your network — try again in a moment." }, { status: 429 });
  }
  const norm = normalizeKey(raw);
  if (!browse && norm.length < 3) return NextResponse.json({ ok: true, suggestions: [] });

  // Practice rounds (supporter perk) look the dataset up by revision instead.
  const dataset = practice
    ? (await getEntitlements(guestId)).features.practice
      ? await practiceDataset(revisionId)
      : null
    : await getTargetDatasetForRound(guestId, attemptId, ordinal);
  if (!dataset) return NextResponse.json({ ok: true, suggestions: [] });

  const rows = await q<{ label: string; disambiguator: string | null }>(
    `select e.label, e.disambiguator
     from target_entries e
     where e.dataset_id = $1
       and ($3::text[] is null or e.entry_id = any($3::text[]))
       and ($2 = '' or exists (
         select 1 from target_lookup l
         where l.dataset_id = e.dataset_id and l.entry_id = e.entry_id and l.norm_key like $2 || '%'
       ))
     order by e.label, e.disambiguator
     limit $4`,
    [dataset.datasetId, browse && norm.length < 3 ? "" : norm, dataset.eligibleEntryIds, browse ? 100 : 8],
  );

  if (rows.length > 0) {
    return NextResponse.json({
      ok: true,
      suggestions: rows.map((r) => ({ label: r.label, disambiguator: r.disambiguator })),
    });
  }

  // B4/Q16: autocomplete is prefix-only. Fuzzy typo matching is reserved for
  // the after-Lock correction flow, never for live suggestions.
  return NextResponse.json({ ok: true, suggestions: [] });
}
