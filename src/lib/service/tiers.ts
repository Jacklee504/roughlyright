import { getDb, type Queryable } from "@/lib/db/client";
import { freemiumEnabled } from "@/lib/billing/config";

/**
 * Freemium tiers. The daily, streaks, sharing, recent archive and core stats
 * are free forever; the supporter tier adds depth (full archive, practice,
 * deeper stats) and cosmetics. Every gate is enforced server-side through
 * `featuresFor` / `getEntitlements`; pages only decide how to present a lock.
 *
 * When no purchase path is configured (BILLING_MODE=off, the production
 * default) nothing is gated: every guest gets the full feature set, so the
 * game never shows a paywall nobody can pass.
 */

export type Tier = "free" | "supporter";

export type TierFeatures = {
  /** How many of the most recent released dates the archive opens (Infinity = all). */
  archiveDays: number;
  /** Unlimited, unrecorded practice rounds from past puzzles. */
  practice: boolean;
  /** Full history, category strengths and calibration trend on the stats page. */
  deepStats: boolean;
  /** Cosmetic sky themes. */
  themes: boolean;
  /** Supporter badge on results and shared links. */
  supporterBadge: boolean;
};

export const FREE_ARCHIVE_DAYS = 7;

const FEATURES: Record<Tier, TierFeatures> = {
  free: { archiveDays: FREE_ARCHIVE_DAYS, practice: false, deepStats: false, themes: false, supporterBadge: false },
  supporter: { archiveDays: Infinity, practice: true, deepStats: true, themes: true, supporterBadge: true },
};

export const THEMES = [
  { id: "night", name: "Night shift", free: true },
  { id: "dawn", name: "First light", free: false },
  { id: "aurora", name: "Aurora", free: false },
  { id: "ember", name: "Ember", free: false },
] as const;
export type ThemeId = (typeof THEMES)[number]["id"];

export function isTheme(v: unknown): v is ThemeId {
  return typeof v === "string" && THEMES.some((t) => t.id === v);
}

/** Nominal features of a tier, ignoring whether freemium is switched on. */
export function tierFeatures(tier: Tier): TierFeatures {
  return FEATURES[tier] ?? FEATURES.free;
}

/** Effective features for a guest's tier under the current billing config. */
export function featuresFor(tier: Tier): TierFeatures {
  if (!freemiumEnabled()) return { ...FEATURES.supporter, supporterBadge: tier === "supporter" };
  return tierFeatures(tier);
}

export function hasFeature(tier: Tier, feature: keyof TierFeatures): boolean {
  const v = featuresFor(tier)[feature];
  return typeof v === "number" ? v > 0 : v === true;
}

export function isTier(value: string | null | undefined): value is Tier {
  return value === "free" || value === "supporter";
}

/** Read a guest's tier; unknown rows and values fall back to 'free'. */
export async function getTier(guestId: string | null, client?: Queryable): Promise<Tier> {
  if (!guestId) return "free";
  const c = client ?? (await getDb());
  const rows = await c.query<{ tier: string }>(`select tier from guests where id = $1`, [guestId]);
  return isTier(rows.rows[0]?.tier) ? rows.rows[0].tier : "free";
}

export type Entitlements = {
  tier: Tier;
  features: TierFeatures;
  theme: ThemeId;
  freemium: boolean;
};

export async function getEntitlements(guestId: string | null, client?: Queryable): Promise<Entitlements> {
  if (!guestId) return { tier: "free", features: featuresFor("free"), theme: "night", freemium: freemiumEnabled() };
  const c = client ?? (await getDb());
  const rows = await c.query<{ tier: string; theme: string }>(`select tier, theme from guests where id = $1`, [guestId]);
  const tier = isTier(rows.rows[0]?.tier) ? (rows.rows[0].tier as Tier) : "free";
  const features = featuresFor(tier);
  const stored = rows.rows[0]?.theme;
  const theme: ThemeId = isTheme(stored) && (features.themes || stored === "night") ? stored : "night";
  return { tier, features, theme, freemium: freemiumEnabled() };
}

/** Grant (or reset) a tier, stamping when it changed. Service-side only. */
export async function setTier(guestId: string, tier: Tier, client?: Queryable): Promise<void> {
  const c = client ?? (await getDb());
  await c.query(
    `update guests set tier = $2, tier_since = case when tier = $2 then tier_since else now() end where id = $1`,
    [guestId, tier],
  );
}

export async function setTheme(guestId: string, theme: ThemeId): Promise<{ ok: true } | { ok: false; message: string }> {
  const ent = await getEntitlements(guestId);
  if (theme !== "night" && !ent.features.themes) {
    return { ok: false, message: "Sky themes are a supporter perk." };
  }
  const db = await getDb();
  await db.query(`update guests set theme = $2 where id = $1`, [guestId, theme]);
  return { ok: true };
}
