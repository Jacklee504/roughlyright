/**
 * Coarse in-memory rate limiting (per guest, per instance). Protects mutations
 * and autocomplete lookups from abuse without interrupting normal play.
 * Production would move this to a shared store alongside hosting.
 */

type Bucket = { count: number; resetAt: number };
const buckets = new Map<string, Bucket>();

export function rateLimit(key: string, limit: number, windowMs: number): boolean {
  const nowMs = Date.now();
  const b = buckets.get(key);
  if (!b || b.resetAt <= nowMs) {
    buckets.set(key, { count: 1, resetAt: nowMs + windowMs });
    return true;
  }
  if (b.count >= limit) return false;
  b.count++;
  return true;
}

// Occasional cleanup so the map does not grow unbounded.
setInterval(() => {
  const nowMs = Date.now();
  for (const [k, v] of buckets) if (v.resetAt <= nowMs) buckets.delete(k);
}, 60_000).unref?.();
