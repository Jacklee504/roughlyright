import { createHash, randomBytes, randomUUID } from "node:crypto";
import { getDb, type Queryable } from "@/lib/db/client";
import { setTier } from "@/lib/service/tiers";

/**
 * Supporter purchases. A checkout creates a pending purchase row; completing
 * it (mock checkout, Stripe success redirect or Stripe webhook, whichever
 * lands first) marks it paid exactly once, grants the supporter tier and
 * issues a restore code. Only a SHA-256 of the restore code is stored.
 */

export const MAX_RESTORE_USES = 5;

export type PurchaseRow = {
  id: string;
  guest_id: string | null;
  provider: string;
  provider_ref: string | null;
  status: string;
  created_at: string;
  completed_at: string | null;
};

export function hashRestoreCode(code: string): string {
  return createHash("sha256").update(normalizeRestoreCode(code)).digest("hex");
}

/** Codes are shown as RR-XXXX-XXXX-XXXX; matching ignores case, spaces and dashes. */
export function normalizeRestoreCode(code: string): string {
  return code.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no 0/O/1/I lookalikes

export function newRestoreCode(): string {
  const bytes = randomBytes(12);
  let s = "";
  for (const b of bytes) s += ALPHABET[b % ALPHABET.length];
  return `RR-${s.slice(0, 4)}-${s.slice(4, 8)}-${s.slice(8, 12)}`;
}

export async function createPurchase(
  guestId: string,
  provider: "mock" | "stripe",
  client?: Queryable,
): Promise<{ id: string }> {
  const c = client ?? (await getDb());
  const id = randomUUID();
  await c.query(`insert into purchases (id, guest_id, provider, status) values ($1, $2, $3, 'pending')`, [id, guestId, provider]);
  return { id };
}

export async function attachProviderRef(purchaseId: string, ref: string): Promise<void> {
  const db = await getDb();
  await db.query(`update purchases set provider_ref = $2 where id = $1`, [purchaseId, ref]);
}

export async function getPurchase(purchaseId: string): Promise<PurchaseRow | null> {
  const db = await getDb();
  const rows = await db.query<PurchaseRow>(
    `select id, guest_id, provider, provider_ref, status, created_at::text as created_at, completed_at::text as completed_at
     from purchases where id = $1`,
    [purchaseId],
  );
  return rows.rows[0] ?? null;
}

/**
 * Mark a purchase paid and grant the tier. Idempotent: only the first call
 * flips the row and returns a fresh restore code; later calls return
 * `alreadyCompleted` with no code (codes are never retrievable afterwards).
 */
export async function completePurchase(
  purchaseId: string,
  details: { amountCents?: number | null; currency?: string | null; providerRef?: string | null } = {},
): Promise<{ ok: true; restoreCode: string | null; alreadyCompleted: boolean; guestId: string | null } | { ok: false; message: string }> {
  const db = await getDb();
  return db.transaction(async (tx) => {
    const rows = await tx.query<{ id: string; guest_id: string | null; status: string }>(
      `select id, guest_id, status from purchases where id = $1 for update`,
      [purchaseId],
    );
    const row = rows.rows[0];
    if (!row) return { ok: false as const, message: "Purchase not found." };
    if (row.status === "paid") return { ok: true as const, restoreCode: null, alreadyCompleted: true, guestId: row.guest_id };
    const code = newRestoreCode();
    await tx.query(
      `update purchases set status = 'paid', completed_at = now(), restore_hash = $2,
              amount_cents = coalesce($3, amount_cents), currency = coalesce($4, currency),
              provider_ref = coalesce($5, provider_ref)
       where id = $1`,
      [purchaseId, hashRestoreCode(code), details.amountCents ?? null, details.currency ?? null, details.providerRef ?? null],
    );
    if (row.guest_id) await setTier(row.guest_id, "supporter", tx);
    return { ok: true as const, restoreCode: code, alreadyCompleted: false, guestId: row.guest_id };
  });
}

export async function cancelPurchase(purchaseId: string, guestId: string): Promise<void> {
  const db = await getDb();
  await db.query(`update purchases set status = 'cancelled' where id = $1 and guest_id = $2 and status = 'pending'`, [purchaseId, guestId]);
}

/**
 * Issue a fresh restore code for the guest's most recent paid purchase (the
 * old code stops working). Used when the code was missed, e.g. because a
 * webhook completed the purchase before the success page loaded.
 */
export async function rotateRestoreCode(guestId: string): Promise<{ ok: true; restoreCode: string } | { ok: false; message: string }> {
  const db = await getDb();
  const rows = await db.query<{ id: string }>(
    `select id from purchases where guest_id = $1 and status = 'paid' order by completed_at desc limit 1`,
    [guestId],
  );
  const id = rows.rows[0]?.id;
  if (!id) return { ok: false, message: "No completed purchase is linked to this browser." };
  const code = newRestoreCode();
  await db.query(`update purchases set restore_hash = $2, restore_uses = 0 where id = $1`, [id, hashRestoreCode(code)]);
  return { ok: true, restoreCode: code };
}

/** Redeem a restore code on this browser. Each code works on a handful of browsers. */
export async function redeemRestoreCode(guestId: string, code: string): Promise<{ ok: true } | { ok: false; code: "invalid_code" | "exhausted"; message: string }> {
  if (normalizeRestoreCode(code).length < 10) return { ok: false, code: "invalid_code", message: "That code isn't valid. Check it and try again." };
  const db = await getDb();
  return db.transaction(async (tx) => {
    const rows = await tx.query<{ id: string; restore_uses: number; guest_id: string | null }>(
      `select id, restore_uses, guest_id from purchases where restore_hash = $1 and status = 'paid' for update`,
      [hashRestoreCode(code)],
    );
    const row = rows.rows[0];
    if (!row) return { ok: false as const, code: "invalid_code" as const, message: "That code isn't valid. Check it and try again." };
    if (row.guest_id !== guestId) {
      if (row.restore_uses >= MAX_RESTORE_USES) {
        return { ok: false as const, code: "exhausted" as const, message: "This code has been used on too many browsers." };
      }
      await tx.query(`update purchases set restore_uses = restore_uses + 1 where id = $1`, [row.id]);
    }
    await setTier(guestId, "supporter", tx);
    return { ok: true as const };
  });
}
