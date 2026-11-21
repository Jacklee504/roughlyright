import { NextRequest, NextResponse } from "next/server";
import { guardMutation } from "@/lib/http/guard";
import { isUuid } from "@/lib/http/validate";
import { getEntitlements } from "@/lib/service/tiers";
import { nextPracticePrompt, practiceHint, resolvePractice } from "@/lib/service/practice";

export const dynamic = "force-dynamic";

/**
 * Practice mode (supporter perk, enforced here). One endpoint, three actions:
 *   { action: "next", exclude?: uuid[], roundType? }  → a past prompt (public fields only)
 *   { action: "resolve", revisionId, pass? | guess? | entity? } → scored reveal, never stored
 *   { action: "hint", revisionId } → the prompt's hint
 */
export async function POST(req: NextRequest) {
  const g = await guardMutation(req, "practice", 90, 600);
  if (!g.ok) return g.res;
  const ent = await getEntitlements(g.guestId);
  if (!ent.features.practice) {
    return NextResponse.json({ ok: false, code: "supporter_required", message: "Practice mode is a supporter perk." }, { status: 403 });
  }
  const body = await req.json().catch(() => null);
  const action = body?.action;

  if (action === "next") {
    const exclude = Array.isArray(body.exclude) ? body.exclude.filter((x: unknown): x is string => isUuid(x)) : [];
    const roundType = ["direct_fact", "calculation", "target_match"].includes(body.roundType) ? (body.roundType as string) : null;
    const prompt = (await nextPracticePrompt(exclude, roundType)) ?? (exclude.length ? await nextPracticePrompt([], roundType) : null);
    if (!prompt) return NextResponse.json({ ok: false, code: "empty", message: "No past rounds to practise yet. Come back after a few dailies." }, { status: 404 });
    return NextResponse.json({ ok: true, prompt });
  }

  if (action === "resolve") {
    if (!isUuid(body.revisionId)) return NextResponse.json({ ok: false, code: "bad_request", message: "Missing round." }, { status: 400 });
    const r = await resolvePractice(body.revisionId, {
      pass: body.pass === true,
      guess: typeof body.guess === "string" ? body.guess.slice(0, 200) : undefined,
      entity: typeof body.entity === "string" ? body.entity.slice(0, 200) : undefined,
    });
    return NextResponse.json(r, { status: r.ok || r.code === "invalid_input" ? 200 : 404 });
  }

  if (action === "hint") {
    if (!isUuid(body.revisionId)) return NextResponse.json({ ok: false, code: "bad_request", message: "Missing round." }, { status: 400 });
    const hint = await practiceHint(body.revisionId);
    if (!hint) return NextResponse.json({ ok: false, code: "not_available", message: "This round has no hint." }, { status: 404 });
    return NextResponse.json({ ok: true, hint });
  }

  return NextResponse.json({ ok: false, code: "bad_request", message: "Unknown action." }, { status: 400 });
}
