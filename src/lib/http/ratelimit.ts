/**
 * Rate limiting (Q26, Q49). Two layers, both coarse and fail-open:
 *
 * 1. Per-guest (or per-reporter) limits — in-memory buckets locally; on
 *    hosted Postgres (DATABASE_URL set) the buckets live in the
 *    `rate_limit_hits` table so counters are shared across serverless
 *    instances. Bucket keys are hashed; nothing identifying is stored.
 * 2. Network-key limits — a salted hash of the coarse client network prefix
 *    (/24 IPv4, /48 IPv6) from the proxy chain. Raw IPs are never retained.
 *
 * On any limiter error the check fails *open* (request allowed): availability
 * outranks precision for a game with no money at stake.
 */

import { createHash } from "node:crypto";
import { databaseUrl } from "@/lib/db/client";

type Bucket = { count: number; resetAt: number };
const memory = new Map<string, Bucket>();

// Occasional cleanup so the map does not grow unbounded.
setInterval(() => {
  const nowMs = Date.now();
  for (const [k, v] of memory) if (v.resetAt <= nowMs) memory.delete(k);
}, 60_000).unref?.();

const WINDOW_MS = 60_000;

async function limitDb(bucketBase: string, limit: number, windowMs: number, nowMs: number): Promise<boolean> {
  const { getDb } = await import("@/lib/db/client");
  const db = await getDb();
  const index = Math.floor(nowMs / windowMs);
  const bucket = `${bucketBase}|${index}`;
  const rows = await db.query<{ count: number; window_start: string }>(
    `insert into rate_limit_hits (bucket, count, window_start)
     values ($1, 1, to_timestamp($2::double precision / 1000.0))
     on conflict (bucket) do update set count = rate_limit_hits.count + 1
     returning count`,
    [bucket, index * windowMs],
  );
  // Opportunistic cleanup of expired windows (cheap, index-free bounded work).
  if (Math.random() < 0.02) {
    await db
      .query(`delete from rate_limit_hits where window_start < to_timestamp($1::double precision)`, [
        (nowMs - 10 * WINDOW_MS) / 1000,
      ])
      .catch(() => undefined);
  }
  return (rows.rows[0]?.count ?? limit) <= limit;
}

export function rateLimit(key: string, limit: number, windowMs = WINDOW_MS): boolean {
  const nowMs = Date.now();
  const b = memory.get(key);
  if (!b || b.resetAt <= nowMs) {
    memory.set(key, { count: 1, resetAt: nowMs + windowMs });
    return true;
  }
  if (b.count >= limit) return false;
  b.count++;
  return true;
}

/**
 * Per-key limit with a shared store on hosted Postgres. Falls back to the
 * in-memory limiter (and fails open on any database error).
 */
export async function rateLimitShared(key: string, limit: number, windowMs = WINDOW_MS): Promise<boolean> {
  if (!databaseUrl()) return rateLimit(key, limit, windowMs);
  try {
    return await limitDb(sha256(key), limit, windowMs, Date.now());
  } catch {
    return rateLimit(key, limit, windowMs); // degrade to per-instance memory
  }
}

function sha256(s: string): string {
  return createHash("sha256").update(s).digest("hex").slice(0, 32);
}

/** Coarse network bucket from the proxy chain — hashed, never stored raw. */
export function networkKey(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for") ?? "";
  const ip = fwd.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "unknown";
  let coarse = ip;
  const v4 = /^(\d+)\.(\d+)\.(\d+)\.(\d+)$/.exec(ip);
  if (v4) coarse = `${v4[1]}.${v4[2]}.${v4[3]}`; // /24
  else if (ip.includes(":")) {
    const h = ip.split(":").filter(Boolean).slice(0, 3).join(":"); // /48-ish
    coarse = h;
  }
  return `net:${sha256(coarse)}`;
}

/** Coarse network-level limit for one public endpoint (hashed bucket). */
export async function rateLimitNetwork(req: Request, key: string, limitPerMin: number): Promise<boolean> {
  return rateLimitShared(`${key}:${networkKey(req)}`, limitPerMin, 60_000);
}
