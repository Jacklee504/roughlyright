import { NextRequest, NextResponse } from "next/server";
import { guardMutation } from "@/lib/http/guard";
import { isTheme, setTheme } from "@/lib/service/tiers";

export const dynamic = "force-dynamic";

/** Choose a cosmetic sky theme. Non-default themes need the supporter tier. */
export async function POST(req: NextRequest) {
  const g = await guardMutation(req, "theme", 20, 120);
  if (!g.ok) return g.res;
  const body = await req.json().catch(() => null);
  if (!body || !isTheme(body.theme)) {
    return NextResponse.json({ ok: false, code: "bad_request", message: "Unknown theme." }, { status: 400 });
  }
  const r = await setTheme(g.guestId, body.theme);
  if (!r.ok) return NextResponse.json({ ok: false, code: "supporter_required", message: r.message }, { status: 403 });
  return NextResponse.json({ ok: true, theme: body.theme });
}
