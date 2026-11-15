import { NextRequest, NextResponse } from "next/server";
import { getGuestId } from "@/lib/http/session";
import { sameOrigin } from "@/lib/http/origin";
import { rateLimit } from "@/lib/http/ratelimit";
import { isUuid } from "@/lib/http/validate";
import { getAttemptState } from "@/lib/service/attempts";

export const dynamic = "force-dynamic";

/** Reload restores the last committed server state (read; expiry is applied lazily). */
export async function POST(req: NextRequest) {
  if (!sameOrigin(req)) {
    return NextResponse.json({ ok: false, code: "bad_origin", message: "Blocked cross-origin submission." }, { status: 403 });
  }
  const guestId = await getGuestId();
  if (!guestId) return NextResponse.json({ ok: false, code: "no_guest", message: "Cookies are required." }, { status: 400 });
  if (!rateLimit(`state:${guestId}`, 120, 60_000)) {
    return NextResponse.json({ ok: false, code: "rate_limited", message: "Too many requests." }, { status: 429 });
  }
  const body = await req.json().catch(() => null);
  if (!body || !isUuid(body.attemptId)) {
    return NextResponse.json({ ok: false, code: "bad_request", message: "Missing attempt id." }, { status: 400 });
  }
  const result = await getAttemptState(guestId, body.attemptId);
  const status = result.ok ? 200 : result.code === "not_found" ? 404 : 403;
  return NextResponse.json(result, { status });
}
