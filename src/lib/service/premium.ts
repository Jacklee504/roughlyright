import { q } from "@/lib/db/client";
import { ensureGuest } from "@/lib/http/session";

/**
 * Freemium entitlements.
 *
 * Premium is stored per guest (`guests.premium`). Two grant paths:
 * - `PREMIUM_CODES` env: comma-separated owner-issued codes, redeemable in the
 *   upgrade screen (`/estimation/upgrade`). Codes live only in the
 *   environment — never in the repo.
 * - `PREMIUM_ALL=1` env: environment-wide unlock (local dev / demo). Used by
 *   `npm run dev:premium`.
 *
 * Free tier limits are declared here so pages share one source of truth.
 */

export const FREE_ARCHIVE_DAYS = 7;

export function premiumUnlockedByEnv(): boolean {
  return process.env.PREMIUM_ALL === "1";
}

export async function isPremiumGuest(guestId: string | null): Promise<boolean> {
  if (!guestId) return false;
  if (premiumUnlockedByEnv()) return true;
  const rows = await q<{ premium: boolean }>(
    `select premium from guests where id = $1`,
    [guestId],
  );
  return rows[0]?.premium === true;
}

export type RedeemResult =
  | { ok: true }
  | { ok: false; message: string };

export async function redeemPremiumCode(guestId: string, rawCode: string): Promise<RedeemResult> {
  const code = rawCode.trim().toUpperCase();
  if (!code || code.length > 64) {
    return { ok: false, message: "Enter an upgrade code." };
  }
  const configured = (process.env.PREMIUM_CODES ?? "")
    .split(",")
    .map((c) => c.trim().toUpperCase())
    .filter(Boolean);
  if (configured.length === 0) {
    return { ok: false, message: "Online upgrades aren't available yet — codes are coming soon." };
  }
  if (!configured.includes(code)) {
    return { ok: false, message: "That code isn't valid." };
  }
  await ensureGuest(guestId);
  await q(
    `insert into guests (id, premium, premium_since, premium_code)
     values ($1, true, now(), $2)
     on conflict (id) do update set premium = true,
       premium_since = coalesce(guests.premium_since, now()),
       premium_code = excluded.premium_code`,
    [guestId, code],
  );
  return { ok: true };
}

/** Which archive dates the guest may open: null = no limit (premium). */
export function archiveFloorDate(today: string, premium: boolean): string | null {
  if (premium) return null;
  const d = new Date(`${today}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - (FREE_ARCHIVE_DAYS - 1));
  return d.toISOString().slice(0, 10);
}
