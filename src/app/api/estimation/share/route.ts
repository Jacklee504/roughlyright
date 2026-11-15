import { NextRequest, NextResponse } from "next/server";
import { getGuestId, ensureGuest } from "@/lib/http/session";
import { sameOrigin } from "@/lib/http/origin";
import { rateLimit } from "@/lib/http/ratelimit";
import { isUuid } from "@/lib/http/validate";
import { createShare, revokeShare } from "@/lib/service/share";

export const dynamic = "force-dynamic";

/** Create (or return the existing) spoiler-free share link for a completed attempt. */
export async function POST(req: NextRequest) {
  if (!sameOrigin(req)) {
    return NextResponse.json({ ok: false, code: "bad_origin", message: "Blocked cross-origin submission." }, { status: 403 });
  }
  const guestId = await getGuestId();
  if (!guestId) return NextResponse.json({ ok: false, code: "no_guest", message: "Cookies are required." }, { status: 400 });
  await ensureGuest(guestId);
  if (!rateLimit(`share:${guestId}`, 20, 60_000)) {
    return NextResponse.json({ ok: false, code: "rate_limited", message: "Too many share actions — try again in a moment." }, { status: 429 });
  }
  const body = await req.json().catch(() => null);
  if (!body || !isUuid(body.attemptId)) {
    return NextResponse.json({ ok: false, code: "bad_request", message: "Missing attempt id." }, { status: 400 });
  }
  const result = await createShare(guestId, body.attemptId, body.comparison === true);
  if (!result.ok) return NextResponse.json({ ok: false, code: "not_allowed", message: result.message }, { status: 404 });
  return NextResponse.json({ ok: true, token: result.token, url: `/estimation/result/${result.token}` });
}

/** Revoke an owned share token. */
export async function DELETE(req: NextRequest) {
  if (!sameOrigin(req)) {
    return NextResponse.json({ ok: false, code: "bad_origin", message: "Blocked cross-origin submission." }, { status: 403 });
  }
  const guestId = await getGuestId();
  if (!guestId) return NextResponse.json({ ok: false, code: "no_guest", message: "Cookies are required." }, { status: 400 });
  const body = await req.json().catch(() => null);
  if (!body || typeof body.token !== "string") {
    return NextResponse.json({ ok: false, code: "bad_request", message: "Missing token." }, { status: 400 });
  }
  const result = await revokeShare(guestId, body.token);
  return NextResponse.json({ ok: result.ok });
}
