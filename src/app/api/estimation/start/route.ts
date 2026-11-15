import { NextRequest, NextResponse } from "next/server";
import { getGuestId, ensureGuest } from "@/lib/http/session";
import { sameOrigin } from "@/lib/http/origin";
import { rateLimit } from "@/lib/http/ratelimit";
import { startOrResume } from "@/lib/service/attempts";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  if (!sameOrigin(req)) {
    return NextResponse.json({ ok: false, code: "bad_origin", message: "Blocked cross-origin submission." }, { status: 403 });
  }
  const guestId = await getGuestId();
  if (!guestId) return NextResponse.json({ ok: false, code: "no_guest", message: "Cookies are required to play." }, { status: 400 });
  await ensureGuest(guestId);
  if (!rateLimit(`start:${guestId}`, 30, 60_000)) {
    return NextResponse.json({ ok: false, code: "rate_limited", message: "Too many requests — try again in a moment." }, { status: 429 });
  }
  const body = await req.json().catch(() => ({}));
  const result = await startOrResume(guestId, {
    game: "estimation",
    date: typeof body.date === "string" ? body.date : undefined,
    mode: body.mode === "archive" ? "archive" : body.mode === "daily" ? "daily" : undefined,
  });
  if (!result.ok) {
    const status = result.code === "unavailable" ? 200 : result.code === "forbidden" ? 403 : 404;
    return NextResponse.json(result, { status });
  }
  return NextResponse.json(result);
}
