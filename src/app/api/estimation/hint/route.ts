import { NextRequest, NextResponse } from "next/server";
import { getGuestId } from "@/lib/http/session";
import { sameOrigin } from "@/lib/http/origin";
import { rateLimit, rateLimitNetwork } from "@/lib/http/ratelimit";
import { isUuid } from "@/lib/http/validate";
import { getHint } from "@/lib/service/attempts";

export const dynamic = "force-dynamic";

/** Server-supplied hint content for the open round. Opening a hint never affects score. */
export async function POST(req: NextRequest) {
  if (!sameOrigin(req)) {
    return NextResponse.json({ ok: false, code: "bad_origin", message: "Blocked cross-origin submission." }, { status: 403 });
  }
  const guestId = await getGuestId();
  if (!guestId) return NextResponse.json({ ok: false, code: "no_guest", message: "Cookies are required." }, { status: 400 });
  if (!rateLimit(`hint:${guestId}`, 60, 60_000)) {
    return NextResponse.json({ ok: false, code: "rate_limited", message: "Too many requests." }, { status: 429 });
  }
  // Q26: coarse hashed network-key limit alongside the per-guest one.
  if (!(await rateLimitNetwork(req, "hint-net", 300))) {
    return NextResponse.json({ ok: false, code: "rate_limited", message: "Too many requests from your network — try again in a moment." }, { status: 429 });
  }
  const body = await req.json().catch(() => null);
  if (!body || !isUuid(body.attemptId) || typeof body.ordinal !== "number") {
    return NextResponse.json({ ok: false, code: "bad_request", message: "Missing attempt or ordinal." }, { status: 400 });
  }
  const result = await getHint(guestId, body.attemptId, body.ordinal);
  if (!result.ok) return NextResponse.json({ ok: false, code: "not_available", message: result.message }, { status: 404 });
  const hint = result.hint as { text?: string; figure?: { value: string; unit: string; scope?: string }; image?: { url: string; alt: string; credit: string; rights: string } } | null;
  if (!hint) return NextResponse.json({ ok: false, code: "not_available", message: "This round has no hint." }, { status: 404 });
  // Text fallback accompanies the image so a failed image load keeps the round usable.
  return NextResponse.json({ ok: true, hint });
}
