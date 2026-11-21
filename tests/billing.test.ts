import { createHmac } from "node:crypto";
import { afterEach, describe, expect, it } from "vitest";
import { verifyWebhookSignature } from "@/lib/billing/stripe";
import { billingMode, freemiumEnabled, stripeConfig } from "@/lib/billing/config";

const ENV_KEYS = ["BILLING_MODE", "STRIPE_SECRET_KEY", "STRIPE_PRICE_ID", "STRIPE_ALLOW_LIVE", "STRIPE_WEBHOOK_SECRET"] as const;
const saved = Object.fromEntries(ENV_KEYS.map((k) => [k, process.env[k]]));
afterEach(() => {
  for (const k of ENV_KEYS) {
    if (saved[k] === undefined) delete process.env[k];
    else process.env[k] = saved[k];
  }
});

function sign(body: string, secret: string, t: number): string {
  const sig = createHmac("sha256", secret).update(`${t}.${body}`).digest("hex");
  return `t=${t},v1=${sig}`;
}

describe("Stripe webhook signatures", () => {
  const secret = "whsec_unit_test_only";
  const body = JSON.stringify({ type: "checkout.session.completed" });
  const t = 1_800_000_000;

  it("accepts a correct, fresh signature", () => {
    expect(verifyWebhookSignature(body, sign(body, secret, t), secret, t + 10)).toBe(true);
  });
  it("rejects a tampered body", () => {
    expect(verifyWebhookSignature(body + " ", sign(body, secret, t), secret, t)).toBe(false);
  });
  it("rejects the wrong secret", () => {
    expect(verifyWebhookSignature(body, sign(body, "whsec_other", t), secret, t)).toBe(false);
  });
  it("rejects stale timestamps and missing headers", () => {
    expect(verifyWebhookSignature(body, sign(body, secret, t), secret, t + 3600)).toBe(false);
    expect(verifyWebhookSignature(body, null, secret, t)).toBe(false);
    expect(verifyWebhookSignature(body, "garbage", secret, t)).toBe(false);
  });
});

describe("billing config", () => {
  it("honours an explicit BILLING_MODE", () => {
    process.env.BILLING_MODE = "off";
    expect(billingMode()).toBe("off");
    expect(freemiumEnabled()).toBe(false);
    process.env.BILLING_MODE = "mock";
    expect(freemiumEnabled()).toBe(true);
  });
  it("refuses live Stripe keys unless explicitly allowed", () => {
    process.env.BILLING_MODE = "stripe";
    process.env.STRIPE_PRICE_ID = "price_test";
    process.env.STRIPE_SECRET_KEY = "sk_live_placeholder";
    delete process.env.STRIPE_ALLOW_LIVE;
    expect(stripeConfig().ok).toBe(false);
    expect(freemiumEnabled()).toBe(false);
    process.env.STRIPE_SECRET_KEY = "sk_test_placeholder";
    const cfg = stripeConfig();
    expect(cfg.ok).toBe(true);
    if (cfg.ok) expect(cfg.testMode).toBe(true);
  });
  it("stays off when Stripe is selected but unconfigured", () => {
    process.env.BILLING_MODE = "stripe";
    delete process.env.STRIPE_SECRET_KEY;
    expect(freemiumEnabled()).toBe(false);
  });
});
