import { NextResponse } from "next/server";
import { getGuestId } from "@/lib/http/session";
import { exportGuestData } from "@/lib/service/privacy";

export const dynamic = "force-dynamic";

/**
 * Privacy data export (Q25): everything the guest's cookie is linked to —
 * attempts, rounds, scores and share tokens — as a JSON download. Contains no
 * content reports, abuse counters, or answer keys.
 */
export async function GET() {
  const guestId = await getGuestId();
  if (!guestId) {
    return NextResponse.json({ ok: false, code: "no_guest", message: "No data is stored for this browser yet." }, { status: 400 });
  }
  const data = await exportGuestData(guestId);
  if (!data) {
    return NextResponse.json({ ok: false, code: "no_guest", message: "No data is stored for this browser yet." }, { status: 400 });
  }
  const date = data.exportedAt.slice(0, 10);
  return new NextResponse(JSON.stringify(data, null, 2), {
    headers: {
      "content-type": "application/json",
      "content-disposition": `attachment; filename="roughly-right-data-${date}.json"`,
      "cache-control": "no-store",
    },
  });
}
