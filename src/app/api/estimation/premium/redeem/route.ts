import { NextResponse } from "next/server";
import { getGuestId, ensureGuest } from "@/lib/http/session";
import { rateLimit } from "@/lib/http/ratelimit";
import { isPremiumGuest, redeemPremiumCode } from "@/lib/service/premium";
import { recordEvent } from "@/lib/service/stats";

/**
 * Redeem an owner-issued premium code. Codes are configured via the
 * PREMIUM_CODES env var (comma-separated) and never stored in the repo.
 */
export async function POST(request: Request): Promise<NextResponse> {
  const guestId = await getGuestId();
  if (!guestId) {
    return NextResponse.json({ ok: false, message: "No session — reload the page." }, { status: 401 });
  }
  if (!rateLimit(`premium-redeem:${guestId}`, 10, 60_000)) {
    return NextResponse.json({ ok: false, message: "Too many attempts — wait a minute." }, { status: 429 });
  }

  let body: { code?: unknown };
  try {
    body = (await request.json()) as { code?: unknown };
  } catch {
    return NextResponse.json({ ok: false, message: "Invalid request." }, { status: 400 });
  }
  const code = typeof body.code === "string" ? body.code : "";

  const result = await redeemPremiumCode(guestId, code);
  if (!result.ok) {
    return NextResponse.json(result, { status: 400 });
  }

  await ensureGuest(guestId);
  await recordEvent("estimation", "premium_redeemed", null);
  return NextResponse.json({ ok: true, premium: await isPremiumGuest(guestId) });
}
