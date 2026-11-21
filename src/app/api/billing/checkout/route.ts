import { NextRequest, NextResponse } from "next/server";
import { guardMutation, siteOrigin } from "@/lib/http/guard";
import { billingMode, freemiumEnabled } from "@/lib/billing/config";
import { attachProviderRef, createPurchase } from "@/lib/billing/purchases";
import { createCheckoutSession } from "@/lib/billing/stripe";
import { getTier } from "@/lib/service/tiers";
import { logFailure } from "@/lib/log";

export const dynamic = "force-dynamic";

/**
 * Start a supporter checkout. Mock mode routes to the in-app test checkout;
 * Stripe mode creates a hosted Checkout Session (test keys unless the owner
 * explicitly allows live). Returns the URL to send the browser to.
 */
export async function POST(req: NextRequest) {
  const g = await guardMutation(req, "checkout", 10, 60);
  if (!g.ok) return g.res;
  if (!freemiumEnabled()) {
    return NextResponse.json({ ok: false, code: "not_available", message: "Supporter checkout isn't open yet. Everything is free for now." }, { status: 400 });
  }
  if ((await getTier(g.guestId)) === "supporter") {
    return NextResponse.json({ ok: false, code: "already_supporter", message: "You're already a supporter on this browser." }, { status: 409 });
  }
  const mode = billingMode();
  if (mode === "mock") {
    const p = await createPurchase(g.guestId, "mock");
    return NextResponse.json({ ok: true, url: `/supporter/checkout?purchase=${p.id}` });
  }
  const p = await createPurchase(g.guestId, "stripe");
  const session = await createCheckoutSession({ purchaseId: p.id, origin: siteOrigin(req) });
  if (!session.ok) {
    logFailure("checkout_failure", "/api/billing/checkout", "provider_error", {});
    return NextResponse.json({ ok: false, code: "provider_error", message: session.message }, { status: 502 });
  }
  await attachProviderRef(p.id, session.id);
  return NextResponse.json({ ok: true, url: session.url });
}
