import { NextResponse, type NextRequest } from "next/server";
import { getGuestId, ensureGuest } from "./session";
import { sameOrigin } from "./origin";
import { rateLimit, rateLimitNetwork } from "./ratelimit";

/**
 * Shared preamble for mutating JSON routes: same-origin check, guest cookie,
 * per-guest and coarse network rate limits. Returns the guest id, or a ready
 * error response.
 */
export async function guardMutation(
  req: NextRequest,
  key: string,
  perGuestPerMin: number,
  perNetworkPerMin: number,
): Promise<{ ok: true; guestId: string } | { ok: false; res: NextResponse }> {
  if (!sameOrigin(req)) {
    return { ok: false, res: NextResponse.json({ ok: false, code: "bad_origin", message: "Blocked cross-origin request." }, { status: 403 }) };
  }
  const guestId = await getGuestId();
  if (!guestId) {
    return { ok: false, res: NextResponse.json({ ok: false, code: "no_guest", message: "Cookies are required to play." }, { status: 400 }) };
  }
  await ensureGuest(guestId);
  if (!rateLimit(`${key}:${guestId}`, perGuestPerMin, 60_000)) {
    return { ok: false, res: NextResponse.json({ ok: false, code: "rate_limited", message: "Too many requests. Try again in a moment." }, { status: 429 }) };
  }
  if (!(await rateLimitNetwork(req, `${key}-net`, perNetworkPerMin))) {
    return { ok: false, res: NextResponse.json({ ok: false, code: "rate_limited", message: "Too many requests from your network. Try again in a moment." }, { status: 429 }) };
  }
  return { ok: true, guestId };
}

export function siteOrigin(req: NextRequest): string {
  const configured = (process.env.NEXT_PUBLIC_SITE_URL ?? "").trim().replace(/\/+$/, "");
  if (configured) return configured;
  return new URL(req.url).origin;
}
