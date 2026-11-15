import { NextRequest, NextResponse } from "next/server";
import { getGuestId, ensureGuest } from "@/lib/http/session";
import { sameOrigin } from "@/lib/http/origin";
import { rateLimit } from "@/lib/http/ratelimit";
import { isUuid } from "@/lib/http/validate";
import { advanceRound } from "@/lib/service/attempts";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  if (!sameOrigin(req)) {
    return NextResponse.json({ ok: false, code: "bad_origin", message: "Blocked cross-origin submission." }, { status: 403 });
  }
  const guestId = await getGuestId();
  if (!guestId) return NextResponse.json({ ok: false, code: "no_guest", message: "Cookies are required to play." }, { status: 400 });
  await ensureGuest(guestId);
  if (!rateLimit(`advance:${guestId}`, 60, 60_000)) {
    return NextResponse.json({ ok: false, code: "rate_limited", message: "Too many requests — try again in a moment." }, { status: 429 });
  }
  const body = await req.json().catch(() => null);
  if (!body || !isUuid(body.attemptId) || typeof body.ordinal !== "number" || typeof body.requestId !== "string") {
    return NextResponse.json({ ok: false, code: "bad_request", message: "Missing attempt, ordinal or request id." }, { status: 400 });
  }
  const result = await advanceRound(guestId, {
    attemptId: body.attemptId,
    ordinal: body.ordinal,
    requestId: body.requestId,
  });
  const status = result.ok ? 200 : result.code === "wrong_guest" ? 403 : result.code === "not_found" ? 404 : result.code === "stale" ? 409 : 200;
  return NextResponse.json(result, { status });
}
