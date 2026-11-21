import { NextRequest, NextResponse } from "next/server";
import { getGuestId, ensureGuest } from "@/lib/http/session";
import { sameOrigin } from "@/lib/http/origin";
import { rateLimit, rateLimitNetwork } from "@/lib/http/ratelimit";
import { startOrResume } from "@/lib/service/attempts";
import { isUtcDate } from "@/lib/domain/calendar";

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
  // Q26: coarse hashed network-key limit alongside the per-guest one.
  if (!(await rateLimitNetwork(req, "start-net", 120))) {
    return NextResponse.json({ ok: false, code: "rate_limited", message: "Too many requests from your network — try again in a moment." }, { status: 429 });
  }
  const body = (await req.json().catch(() => null)) ?? {};
  if (body.date !== undefined && !isUtcDate(body.date)) {
    return NextResponse.json({ ok: false, code: "bad_request", message: "Dates look like 2026-11-19." }, { status: 400 });
  }
  const result = await startOrResume(guestId, {
    game: "estimation",
    date: typeof body.date === "string" ? body.date : undefined,
    mode: body.mode === "archive" ? "archive" : body.mode === "daily" ? "daily" : undefined,
  });
  if (!result.ok) {
    const status = result.code === "unavailable" ? 200 : result.code === "forbidden" || result.code === "locked" ? 403 : 404;
    return NextResponse.json(result, { status });
  }
  return NextResponse.json(result);
}
