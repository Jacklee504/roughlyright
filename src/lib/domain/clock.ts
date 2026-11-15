/** Injectable clock for deterministic tests and local fixtures. */

let override: Date | null = null;

export function now(): Date {
  return override ?? new Date();
}

export function realNow(): Date {
  return new Date();
}

export function setClock(d: Date | null): void {
  override = d;
}
