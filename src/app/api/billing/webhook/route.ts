import { NextRequest, NextResponse } from "next/server";
import { billingMode, stripeConfig } from "@/lib/billing/config";
import { verifyWebhookSignature } from "@/lib/billing/stripe";
import { completePurchase, getPurchase } from "@/lib/billing/purchases";
import { isUuid } from "@/lib/http/validate";
import { logFailure, logStructured } from "@/lib/log";

export const dynamic = "force-dynamic";

/**
 * Stripe webhook. Verifies the signature against STRIPE_WEBHOOK_SECRET using
 * the raw body, then completes the purchase named by client_reference_id on
 * checkout.session.completed (paid). Idempotent: repeats are acknowledged.
 * Cross-origin by design (Stripe calls it), so no same-origin check; the
 * signature is the authentication.
 */
export async function POST(req: NextRequest) {
  if (billingMode() !== "stripe") return NextResponse.json({ ok: false }, { status: 404 });
  const cfg = stripeConfig();
  if (!cfg.ok || !cfg.webhookSecret) return NextResponse.json({ ok: false }, { status: 503 });
  const raw = await req.text();
  if (!verifyWebhookSignature(raw, req.headers.get("stripe-signature"), cfg.webhookSecret)) {
    logFailure("webhook_failure", "/api/billing/webhook", "bad_signature");
    return NextResponse.json({ ok: false }, { status: 400 });
  }
  let event: { type?: string; data?: { object?: { client_reference_id?: string; payment_status?: string; id?: string; amount_total?: number; currency?: string } } };
  try {
    event = JSON.parse(raw);
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
  if (event.type === "checkout.session.completed" || event.type === "checkout.session.async_payment_succeeded") {
    const s = event.data?.object;
    const purchaseId = s?.client_reference_id ?? "";
    if (s?.payment_status === "paid" && isUuid(purchaseId)) {
      const purchase = await getPurchase(purchaseId);
      if (purchase && purchase.provider === "stripe") {
        await completePurchase(purchaseId, { amountCents: s.amount_total ?? null, currency: s.currency ?? null, providerRef: s.id ?? null });
        logStructured("purchase_completed", { route: "/api/billing/webhook", provider: "stripe" });
      }
    }
  }
  return NextResponse.json({ ok: true });
}
