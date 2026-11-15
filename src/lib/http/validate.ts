/**
 * Request-shape guards. Attempt ids are UUIDs (crypto.randomUUID at creation);
 * validating the shape here keeps malformed ids from reaching Postgres and
 * surfacing as opaque 500s instead of clean "not found" responses.
 */
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID_RE.test(value);
}
