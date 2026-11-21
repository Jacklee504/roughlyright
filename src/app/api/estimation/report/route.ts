import { NextRequest, NextResponse } from "next/server";
import { getGuestId } from "@/lib/http/session";
import { sameOrigin } from "@/lib/http/origin";
import { rateLimit, rateLimitNetwork } from "@/lib/http/ratelimit";
import { isUuid } from "@/lib/http/validate";
import { createContentReport } from "@/lib/service/reports";

export const dynamic = "force-dynamic";

/** Content report from answer review. Private to editorial operators; rate limited. */
export async function POST(req: NextRequest) {
  if (!sameOrigin(req)) {
    return NextResponse.json({ ok: false, code: "bad_origin", message: "Blocked cross-origin submission." }, { status: 403 });
  }
  const guestId = await getGuestId();
  if (!guestId) return NextResponse.json({ ok: false, code: "no_guest", message: "Cookies are required." }, { status: 400 });
  if (!rateLimit(`report:${guestId}`, 5, 60 * 60_000)) {
    return NextResponse.json({ ok: false, code: "rate_limited", message: "You've sent several reports already — thank you, that's plenty for now." }, { status: 429 });
  }
  // Q26: coarse hashed network-key limit alongside the per-guest one.
  if (!(await rateLimitNetwork(req, "report-net", 30))) {
    return NextResponse.json({ ok: false, code: "rate_limited", message: "Too many requests from your network — try again in a moment." }, { status: 429 });
  }
  const body = await req.json().catch(() => null);
  if (
    !body ||
    typeof body.revisionId !== "string" ||
    !isUuid(body.revisionId) ||
    typeof body.reason !== "string" ||
    body.reason.trim().length === 0 ||
    body.reason.length > 2000
  ) {
    return NextResponse.json({ ok: false, code: "bad_request", message: "A short explanation is required." }, { status: 400 });
  }
  const rawUrl = typeof body.url === "string" ? body.url.trim() : "";
  if (rawUrl && (rawUrl.length > 2000 || !/^https?:\/\/[^\s]+$/i.test(rawUrl))) {
    return NextResponse.json({ ok: false, code: "bad_request", message: "The supporting link should start with http:// or https://." }, { status: 400 });
  }
  const url = rawUrl || null;
  const proposed = typeof body.proposedAnswer === "string" && body.proposedAnswer.length <= 500 ? body.proposedAnswer : null;
  await createContentReport({ revisionId: body.revisionId, reason: body.reason.trim(), proposedAnswer: proposed, url });
  return NextResponse.json({ ok: true });
}
