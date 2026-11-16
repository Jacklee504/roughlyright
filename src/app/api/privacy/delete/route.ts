import { NextRequest, NextResponse } from "next/server";
import { getGuestId, GUEST_COOKIE } from "@/lib/http/session";
import { sameOrigin } from "@/lib/http/origin";
import { rateLimit, rateLimitNetwork } from "@/lib/http/ratelimit";
import { deleteGuestData } from "@/lib/service/privacy";

export const dynamic = "force-dynamic";

/**
 * Privacy deletion (Q25): removes this browser's attempts, rounds and share
 * links, then the guest record. Requires an explicit confirmation token in the
 * body ("DELETE MY DATA") — the UI asks the player to type it.
 */
export async function POST(req: NextRequest) {
  if (!sameOrigin(req)) {
    return NextResponse.json({ ok: false, code: "bad_origin", message: "Blocked cross-origin request." }, { status: 403 });
  }
  const guestId = await getGuestId();
  if (!guestId) {
    return NextResponse.json({ ok: false, code: "no_guest", message: "No data is stored for this browser yet." }, { status: 400 });
  }
  if (!rateLimit(`privacy-delete:${guestId}`, 5, 60 * 60_000)) {
    return NextResponse.json({ ok: false, code: "rate_limited", message: "Too many requests." }, { status: 429 });
  }
  // Q26: coarse hashed network-key limit alongside the per-guest one.
  if (!(await rateLimitNetwork(req, "privacy-delete-net", 10))) {
    return NextResponse.json({ ok: false, code: "rate_limited", message: "Too many requests from your network — try again in a moment." }, { status: 429 });
  }
  const body = await req.json().catch(() => null);
  if (!body || body.confirm !== "DELETE MY DATA") {
    return NextResponse.json(
      { ok: false, code: "confirm_required", message: "Type DELETE MY DATA to confirm permanent deletion." },
      { status: 400 },
    );
  }
  const result = await deleteGuestData(guestId);
  if (!result.ok) {
    return NextResponse.json({ ok: false, code: "error", message: result.message }, { status: 500 });
  }
  const res = NextResponse.json({ ok: true, attempts: result.attempts });
  res.cookies.set(GUEST_COOKIE, "", { maxAge: 0, path: "/", httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production" });
  return res;
}
