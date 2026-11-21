import { NextRequest, NextResponse } from "next/server";
import { guardMutation } from "@/lib/http/guard";
import { isUuid } from "@/lib/http/validate";
import { billingMode } from "@/lib/billing/config";
import { cancelPurchase, completePurchase, getPurchase } from "@/lib/billing/purchases";

export const dynamic = "force-dynamic";

/**
 * Mock checkout completion (BILLING_MODE=mock only). Stands in for a payment
 * provider so the whole upgrade flow can be exercised without real money or
 * card details: the page never collects payment data.
 */
export async function POST(req: NextRequest) {
  if (billingMode() !== "mock") {
    return NextResponse.json({ ok: false, code: "not_available", message: "Test checkout is disabled." }, { status: 404 });
  }
  const g = await guardMutation(req, "mock-checkout", 10, 60);
  if (!g.ok) return g.res;
  const body = await req.json().catch(() => null);
  if (!body || !isUuid(body.purchaseId) || (body.action !== "pay" && body.action !== "cancel")) {
    return NextResponse.json({ ok: false, code: "bad_request", message: "Missing purchase or action." }, { status: 400 });
  }
  const purchase = await getPurchase(body.purchaseId);
  if (!purchase || purchase.guest_id !== g.guestId || purchase.provider !== "mock") {
    return NextResponse.json({ ok: false, code: "not_found", message: "Checkout not found." }, { status: 404 });
  }
  if (body.action === "cancel") {
    await cancelPurchase(purchase.id, g.guestId);
    return NextResponse.json({ ok: true, cancelled: true });
  }
  if (purchase.status === "cancelled") {
    return NextResponse.json({ ok: false, code: "cancelled", message: "This checkout was cancelled. Start a new one from the supporter page." }, { status: 409 });
  }
  const done = await completePurchase(purchase.id, { amountCents: 400, currency: "gbp" });
  if (!done.ok) return NextResponse.json({ ok: false, code: "error", message: done.message }, { status: 500 });
  return NextResponse.json({ ok: true, restoreCode: done.restoreCode, alreadyCompleted: done.alreadyCompleted });
}
