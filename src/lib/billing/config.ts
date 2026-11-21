/**
 * Billing configuration. Everything is driven by environment variables so the
 * same build can run free-only, with a mock checkout (local/staging), or with
 * Stripe Checkout in test mode. Secrets are only ever read from the process
 * environment and are never logged or sent to the client.
 *
 *   BILLING_MODE            off | mock | stripe
 *                           default: "mock" outside production, "off" in production
 *   SUPPORTER_PRICE_LABEL   display price, e.g. "£4 one-off" (default "£4 one-off")
 *   STRIPE_SECRET_KEY       sk_test_… (live keys refused unless STRIPE_ALLOW_LIVE=true)
 *   STRIPE_PRICE_ID         price_… for the one-off supporter pass
 *   STRIPE_WEBHOOK_SECRET   whsec_… for /api/billing/webhook
 *   STRIPE_ALLOW_LIVE       "true" to permit a live key (go-live switch)
 *   NEXT_PUBLIC_SITE_URL    absolute origin for Stripe success/cancel URLs
 *
 * With BILLING_MODE=off every feature is free (the owner's launch default):
 * freemium gates only exist when a purchase path exists.
 */

export type BillingMode = "off" | "mock" | "stripe";

export function billingMode(): BillingMode {
  const raw = (process.env.BILLING_MODE ?? "").trim().toLowerCase();
  if (raw === "off" || raw === "mock" || raw === "stripe") return raw;
  return process.env.NODE_ENV === "production" ? "off" : "mock";
}

/** Freemium gates apply only when someone can actually buy the supporter tier. */
export function freemiumEnabled(): boolean {
  const mode = billingMode();
  if (mode === "stripe") return stripeConfig().ok;
  return mode === "mock";
}

export function priceLabel(): string {
  const label = (process.env.SUPPORTER_PRICE_LABEL ?? "").trim();
  return label || "£4 one-off";
}

export type StripeConfig =
  | { ok: true; secretKey: string; priceId: string; webhookSecret: string | null; testMode: boolean }
  | { ok: false; reason: string };

export function stripeConfig(): StripeConfig {
  const secretKey = (process.env.STRIPE_SECRET_KEY ?? "").trim();
  const priceId = (process.env.STRIPE_PRICE_ID ?? "").trim();
  const webhookSecret = (process.env.STRIPE_WEBHOOK_SECRET ?? "").trim() || null;
  if (!secretKey || !priceId) return { ok: false, reason: "Stripe is not configured." };
  const testMode = secretKey.startsWith("sk_test_") || secretKey.startsWith("rk_test_");
  if (!testMode && process.env.STRIPE_ALLOW_LIVE !== "true") {
    return { ok: false, reason: "Live Stripe keys are disabled (set STRIPE_ALLOW_LIVE=true to go live)." };
  }
  return { ok: true, secretKey, priceId, webhookSecret, testMode };
}

/** Public, non-secret summary for pages. */
export function billingSummary(): { mode: BillingMode; enabled: boolean; priceLabel: string; testMode: boolean } {
  const mode = billingMode();
  const enabled = freemiumEnabled();
  const sc = mode === "stripe" ? stripeConfig() : null;
  return {
    mode,
    enabled,
    priceLabel: priceLabel(),
    testMode: mode === "mock" || (sc?.ok === true && sc.testMode),
  };
}
