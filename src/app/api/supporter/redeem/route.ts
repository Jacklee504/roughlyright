import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { getGuestId, ensureGuest } from "@/lib/http/session";
import { sameOrigin } from "@/lib/http/origin";
import { rateLimit, rateLimitNetwork } from "@/lib/http/ratelimit";
import { getTier, setTier } from "@/lib/service/tiers";
import { redeemRestoreCode } from "@/lib/billing/purchases";

export const dynamic = "force-dynamic";

/**
 * Redeem a code on this browser: either a restore code issued after a
 * purchase (hashed in `purchases`), or an owner-issued gift code listed in
 * SUPPORTER_CODES. Codes are compared in constant time or by hash; the
 * submitted code is never logged.
 */
export async function POST(req: NextRequest) {
  if (!sameOrigin(req)) {
    return NextResponse.json({ ok: false, code: "bad_origin", message: "Blocked cross-origin submission." }, { status: 403 });
  }
  const guestId = await getGuestId();
  if (!guestId) return NextResponse.json({ ok: false, code: "no_guest", message: "Cookies are required." }, { status: 400 });
  if (!rateLimit(`redeem:${guestId}`, 5, 60 * 60_000)) {
    return NextResponse.json({ ok: false, code: "rate_limited", message: "Too many attempts. Try again later." }, { status: 429 });
  }
  if (!(await rateLimitNetwork(req, "redeem-net", 20))) {
    return NextResponse.json({ ok: false, code: "rate_limited", message: "Too many requests from your network." }, { status: 429 });
  }

  const body = await req.json().catch(() => null);
  const code = typeof body?.code === "string" ? body.code.trim().slice(0, 64) : "";
  if (!code) return NextResponse.json({ ok: false, code: "invalid_input", message: "Enter your code." }, { status: 400 });
  await ensureGuest(guestId);

  const restored = await redeemRestoreCode(guestId, code);
  if (restored.ok) return NextResponse.json({ ok: true, tier: await getTier(guestId) });
  if (restored.code === "exhausted") {
    return NextResponse.json({ ok: false, code: "exhausted", message: restored.message }, { status: 400 });
  }

  const configured = (process.env.SUPPORTER_CODES ?? "")
    .split(",")
    .map((c) => c.trim())
    .filter(Boolean);
  const match = configured.some((c) => {
    const a = Buffer.from(c, "utf8");
    const b = Buffer.from(code, "utf8");
    return a.length === b.length && timingSafeEqual(a, b);
  });
  if (!match) {
    return NextResponse.json({ ok: false, code: "invalid_code", message: "That code isn't valid. Check it and try again." }, { status: 400 });
  }
  await setTier(guestId, "supporter");
  return NextResponse.json({ ok: true, tier: await getTier(guestId) });
}
