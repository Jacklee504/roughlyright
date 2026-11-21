import { createHmac, timingSafeEqual } from "node:crypto";
import { stripeConfig } from "./config";

/**
 * Minimal Stripe Checkout client over fetch (no SDK dependency). Only the
 * calls the supporter pass needs: create a one-off Checkout Session, read a
 * session back on the success redirect, and verify webhook signatures.
 * The guest id never reaches Stripe: the session carries our purchase id as
 * client_reference_id.
 */

const API = "https://api.stripe.com/v1";

function form(params: Record<string, string>): string {
  return Object.entries(params)
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join("&");
}

export async function createCheckoutSession(input: {
  purchaseId: string;
  origin: string;
}): Promise<{ ok: true; id: string; url: string } | { ok: false; message: string }> {
  const cfg = stripeConfig();
  if (!cfg.ok) return { ok: false, message: cfg.reason };
  const res = await fetch(`${API}/checkout/sessions`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${cfg.secretKey}`,
      "content-type": "application/x-www-form-urlencoded",
    },
    body: form({
      mode: "payment",
      "line_items[0][price]": cfg.priceId,
      "line_items[0][quantity]": "1",
      client_reference_id: input.purchaseId,
      "metadata[purchase_id]": input.purchaseId,
      success_url: `${input.origin}/supporter/thanks?purchase=${input.purchaseId}&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${input.origin}/supporter?cancelled=1`,
    }),
  }).catch(() => null);
  if (!res) return { ok: false, message: "Couldn't reach the payment provider. Try again in a moment." };
  const data = (await res.json().catch(() => null)) as { id?: string; url?: string } | null;
  if (!res.ok || !data?.id || !data.url) return { ok: false, message: "The payment provider refused the checkout." };
  return { ok: true, id: data.id, url: data.url };
}

export type StripeSession = {
  id: string;
  payment_status: string;
  status: string;
  client_reference_id: string | null;
  amount_total: number | null;
  currency: string | null;
};

export async function retrieveCheckoutSession(sessionId: string): Promise<StripeSession | null> {
  const cfg = stripeConfig();
  if (!cfg.ok) return null;
  if (!/^cs_[A-Za-z0-9_]+$/.test(sessionId)) return null;
  const res = await fetch(`${API}/checkout/sessions/${sessionId}`, {
    headers: { authorization: `Bearer ${cfg.secretKey}` },
  }).catch(() => null);
  if (!res || !res.ok) return null;
  return (await res.json().catch(() => null)) as StripeSession | null;
}

/**
 * Verify a `Stripe-Signature` header (t=…,v1=…) against the raw body with the
 * endpoint secret, rejecting signatures older than the tolerance.
 */
export function verifyWebhookSignature(rawBody: string, header: string | null, secret: string, nowSec = Math.floor(Date.now() / 1000), toleranceSec = 300): boolean {
  if (!header) return false;
  const parts = header.split(",").map((p) => p.trim().split("="));
  const t = parts.find(([k]) => k === "t")?.[1];
  const sigs = parts.filter(([k]) => k === "v1").map(([, v]) => v);
  if (!t || sigs.length === 0 || !/^\d+$/.test(t)) return false;
  if (Math.abs(nowSec - Number(t)) > toleranceSec) return false;
  const expected = createHmac("sha256", secret).update(`${t}.${rawBody}`).digest("hex");
  const e = Buffer.from(expected, "utf8");
  return sigs.some((s) => {
    const b = Buffer.from(s ?? "", "utf8");
    return b.length === e.length && timingSafeEqual(b, e);
  });
}
