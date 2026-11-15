import { NextRequest, NextResponse } from "next/server";
import { getGuestId, ensureGuest } from "@/lib/http/session";
import { sameOrigin } from "@/lib/http/origin";
import { rateLimit } from "@/lib/http/ratelimit";
import { isUuid } from "@/lib/http/validate";
import { resolveRound } from "@/lib/service/attempts";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  if (!sameOrigin(req)) {
    return NextResponse.json({ ok: false, code: "bad_origin", message: "Blocked cross-origin submission." }, { status: 403 });
  }
  const guestId = await getGuestId();
  if (!guestId) return NextResponse.json({ ok: false, code: "no_guest", message: "Cookies are required to play." }, { status: 400 });
  await ensureGuest(guestId);
  if (!rateLimit(`resolve:${guestId}`, 60, 60_000)) {
    return NextResponse.json({ ok: false, code: "rate_limited", message: "Too many guesses too fast — try again in a moment." }, { status: 429 });
  }
  const body = await req.json().catch(() => null);
  if (
    !body ||
    !isUuid(body.attemptId) ||
    typeof body.ordinal !== "number" ||
    typeof body.requestId !== "string"
  ) {
    return NextResponse.json({ ok: false, code: "bad_request", message: "Missing attempt, ordinal or request id." }, { status: 400 });
  }
  const input =
    body.pass === true
      ? { attemptId: body.attemptId, ordinal: body.ordinal, requestId: body.requestId, pass: true as const }
      : {
          attemptId: body.attemptId,
          ordinal: body.ordinal,
          requestId: body.requestId,
          pass: false as const,
          guess: typeof body.guess === "string" ? body.guess : undefined,
          entity: typeof body.entity === "string" ? body.entity : undefined,
        };
  const result = await resolveRound(guestId, input);
  const status = result.ok
    ? 200
    : result.code === "wrong_guest"
      ? 403
      : result.code === "not_found"
        ? 404
        : result.code === "stale"
          ? 409
          : 200; // invalid_input and expired are recoverable client states
  return NextResponse.json(result, { status });
}
