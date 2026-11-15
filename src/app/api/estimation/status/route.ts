import { NextResponse } from "next/server";
import { getGuestId, ensureGuest } from "@/lib/http/session";
import { getGameStatus } from "@/lib/service/status";

export const dynamic = "force-dynamic";

// Read-only: loading status never creates an attempt.
export async function GET() {
  const guestId = await getGuestId();
  if (guestId) await ensureGuest(guestId);
  const status = await getGameStatus("estimation", guestId);
  return NextResponse.json({ ok: true, status });
}
