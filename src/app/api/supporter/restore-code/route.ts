import { NextRequest, NextResponse } from "next/server";
import { guardMutation } from "@/lib/http/guard";
import { rotateRestoreCode } from "@/lib/billing/purchases";

export const dynamic = "force-dynamic";

/** Issue a new restore code for this browser's purchase (the old one stops working). */
export async function POST(req: NextRequest) {
  const g = await guardMutation(req, "restore-code", 5, 30);
  if (!g.ok) return g.res;
  const r = await rotateRestoreCode(g.guestId);
  if (!r.ok) return NextResponse.json({ ok: false, code: "not_found", message: r.message }, { status: 404 });
  return NextResponse.json({ ok: true, restoreCode: r.restoreCode });
}
