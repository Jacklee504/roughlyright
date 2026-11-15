import { cookies } from "next/headers";
import { q } from "@/lib/db/client";

export const GUEST_COOKIE = "rr_guest";

export async function getGuestId(): Promise<string | null> {
  const jar = await cookies();
  return jar.get(GUEST_COOKIE)?.value ?? null;
}

/** Ensure the guest row exists before mutating that guest's data. */
export async function ensureGuest(guestId: string): Promise<void> {
  await q(`insert into guests (id) values ($1) on conflict (id) do nothing`, [guestId]);
}
