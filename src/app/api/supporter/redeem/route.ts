import { NextRequest, NextResponse } from "next/server";
import { getGuestId, ensureGuest } from "@/lib/http/session";
import { sameOrigin } from "@/lib/http/origin";
import { rateLimit, rateLimitNetwork } from "@/lib/http/ratelimit";
import { getTier, setTier } from "@/lib/service/tiers";
import { timingSafeEqual } from "node:crypto";

export const dynamic = "force-dynamic";

/**
 * Redeem an owner-issued supporter code (freemium plumbing; the tier is
 * dormant until the owner sets SUPPORTER_CODES and starts issuing codes).
 * Codes are compared in constant time; the submitted code is never logged.
 */
export async function POST(req: NextRequest) {
  if (!sameOrigin(req)) {
    return NextResponse.json({ ok: false, code: "bad_origin", message: "Blocked cross-origin submission." }, { status: 403 });
  }
  const guestId = await getGuestId();
  if (!guestId) return NextResponse.json({ ok: false, code: "no_guest", message: "Cookies are required." }, { status: 400 });
  if (!rateLimit(`redeem:${guestId}`, 5, 60 * 60_000)) {
    return NextResponse.json({ ok: false, code: "rate_limited", message: "Too many redemption attempts — try again later." }, { status: 429 });
  }
  if (!(await rateLimitNetwork(req, "redeem-net", 20))) {
    return NextResponse.json({ ok: false, code: "rate_limited", message: "Too many requests from your network." }, { status: 429 });
  }

  const body = await req.json().catch(() => null);
  const code = typeof body?.code === "string" ? body.code.trim() : "";
  if (!code) return NextResponse.json({ ok: false, code: "invalid_input", message: "Enter a supporter code." }, { status: 400 });

  const configured = (process.env.SUPPORTER_CODES ?? "")
    .split(",")
    .map((c) => c.trim())
    .filter(Boolean);
  if (configured.length === 0) {
    return NextResponse.json(
      { ok: false, code: "not_configured", message: "Supporter codes aren't set up yet — the game stays free." },
      { status: 400 },
    );
  }

  const match = configured.some((c) => {
    const a = Buffer.from(c, "utf8");
    const b = Buffer.from(code, "utf8");
    return a.length === b.length && timingSafeEqual(a, b);
  });
  if (!match) {
    return NextResponse.json({ ok: false, code: "invalid_code", message: "That code isn't valid — check it and try again." }, { status: 400 });
  }

  await ensureGuest(guestId);
  await setTier(guestId, "supporter");
  return NextResponse.json({ ok: true, tier: await getTier(guestId) });
}
