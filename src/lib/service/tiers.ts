import { getDb, type Queryable } from "@/lib/db/client";

/**
 * Freemium tier plumbing. At launch every guest is 'free' and every gameplay
 * feature is open — this module exists so a supporter tier can be switched on
 * later (checkout, codes, bundles) without touching feature code again.
 *
 * To gate something: add it to TierFeature, set its per-tier value below, and
 * call `hasFeature` / `tierFeatures` at the gate. Nothing else needs to change.
 */

export type Tier = "free" | "supporter";

export type TierFeatures = {
  /** Archive puzzles playable per UTC day (Infinity = unlimited). */
  archivePerDay: number;
  /** Preserves an interrupted daily streak (not yet a gameplay feature). */
  streakFreeze: boolean;
  /** Cosmetic supporter badge on results and shares. */
  supporterBadge: boolean;
};

const FEATURES: Record<Tier, TierFeatures> = {
  free: { archivePerDay: Infinity, streakFreeze: false, supporterBadge: false },
  supporter: { archivePerDay: Infinity, streakFreeze: true, supporterBadge: true },
};

export function tierFeatures(tier: Tier): TierFeatures {
  return FEATURES[tier] ?? FEATURES.free;
}

export function hasFeature(tier: Tier, feature: keyof TierFeatures): boolean {
  const v = tierFeatures(tier)[feature];
  return typeof v === "number" ? v > 0 : v === true;
}

export function isTier(value: string | null | undefined): value is Tier {
  return value === "free" || value === "supporter";
}

/** Read a guest's tier; unknown rows and values fall back to 'free'. */
export async function getTier(guestId: string, client?: Queryable): Promise<Tier> {
  const c = client ?? (await getDb());
  const rows = await c.query<{ tier: string }>(`select tier from guests where id = $1`, [guestId]);
  return isTier(rows.rows[0]?.tier) ? rows.rows[0].tier : "free";
}

/** Grant (or reset) a tier, stamping when it changed. Service-side only. */
export async function setTier(guestId: string, tier: Tier, client?: Queryable): Promise<void> {
  const c = client ?? (await getDb());
  await c.query(
    `update guests set tier = $2, tier_since = case when tier = $2 then tier_since else now() end where id = $1`,
    [guestId, tier],
  );
}
