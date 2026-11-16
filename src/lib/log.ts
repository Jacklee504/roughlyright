/**
 * Q50 — redacted structured logs for 5xx, resolve and publish failures.
 *
 * One JSON object per line on stdout so a log drain can index events without
 * parsing prose. Redaction is by construction: this module only ever receives
 * coarse fields (route, outcome code, duration). Callers must NOT pass raw
 * guess text, rejected input, report bodies, raw IPs or raw URLs.
 */
export type LogFields = Record<string, string | number | boolean | null>;

export function logStructured(event: string, fields: LogFields = {}): void {
  const line = JSON.stringify({ ts: new Date().toISOString(), event, ...fields });
  process.stdout.write(line + "\n");
}

/** Failure event with the fields Q50 cares about; never logs a message body. */
export function logFailure(event: string, route: string, code: string, extra: LogFields = {}): void {
  logStructured(event, { route, code, ...extra });
}
