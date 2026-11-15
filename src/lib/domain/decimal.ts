/**
 * Exact rational arithmetic over BigInt, for the v1 scoring contract.
 * Values are stored as { n, d } with d > 0. Always reduced on construction.
 */

export type Rat = { n: bigint; d: bigint };

function gcd(a: bigint, b: bigint): bigint {
  a = a < 0n ? -a : a;
  b = b < 0n ? -b : b;
  while (b) {
    const t = a % b;
    a = b;
    b = t;
  }
  return a;
}

export function rat(n: bigint, d: bigint = 1n): Rat {
  if (d === 0n) throw new Error("Division by zero");
  if (d < 0n) {
    n = -n;
    d = -d;
  }
  const g = gcd(n, d) || 1n;
  return { n: n / g, d: d / g };
}

/** Parse a plain decimal string ("123", "1.5", ".5", "5000") into a Rat. */
export function parseDecimalToRat(s: string): Rat | null {
  const m = /^(?:(\d+)(?:\.(\d*))?|\.(\d+))$/.exec(s);
  if (!m) return null;
  const int = m[1] ?? "0";
  const frac = m[2] ?? m[3] ?? "";
  const digits = (int + frac).replace(/^0+(?=\d)/, "");
  const n = BigInt(digits || "0");
  const d = 10n ** BigInt(frac.length);
  return rat(n, d);
}

export function ratFromInt(i: bigint): Rat {
  return { n: i, d: 1n };
}

export function ratZero(): Rat {
  return { n: 0n, d: 1n };
}

export function cmp(a: Rat, b: Rat): number {
  const l = a.n * b.d;
  const r = b.n * a.d;
  return l < r ? -1 : l > r ? 1 : 0;
}

export const eq = (a: Rat, b: Rat) => cmp(a, b) === 0;
export const lt = (a: Rat, b: Rat) => cmp(a, b) < 0;
export const lte = (a: Rat, b: Rat) => cmp(a, b) <= 0;

export const mul = (a: Rat, b: Rat): Rat => rat(a.n * b.n, a.d * b.d);
export const div = (a: Rat, b: Rat): Rat => rat(a.n * b.d, a.d * b.n);
export const add = (a: Rat, b: Rat): Rat => rat(a.n * b.d + b.n * a.d, a.d * b.d);
export const sub = (a: Rat, b: Rat): Rat => rat(a.n * b.d - b.n * a.d, a.d * b.d);

/** 10^k as a Rat (k may be negative). */
export function pow10(k: number): Rat {
  if (k >= 0) return rat(10n ** BigInt(k), 1n);
  return rat(1n, 10n ** BigInt(-k));
}

/**
 * Plain decimal string, never scientific notation.
 * If maxFracDigits is given, round half-up to that many fractional digits,
 * then trim trailing zeros (and a bare trailing dot).
 */
export function ratToString(r: Rat, maxFracDigits?: number): string {
  const neg = r.n < 0n;
  let n = neg ? -r.n : r.n;
  const d = r.d;
  if (maxFracDigits === undefined) {
    // Exact expansion: scale so d becomes a power of 10 (only valid for decimal-sourced rats).
    let x = n;
    let frac = "";
    let rem = x % d;
    x = x / d;
    let guard = 0;
    while (rem !== 0n && guard < 400) {
      rem *= 10n;
      const digit = rem / d;
      frac += digit.toString();
      rem = rem % d;
      guard++;
    }
    if (rem !== 0n) throw new Error("Non-decimal rational cannot be expanded exactly");
    const body = frac.length ? `${x}.${frac}` : x.toString();
    return (neg ? "-" : "") + body;
  }
  // scale = d * 10^maxFrac
  const scale = d * 10n ** BigInt(maxFracDigits);
  const scaled = n * 10n ** BigInt(maxFracDigits);
  const q = scaled / d;
  const rem = scaled - q * d;
  // half-up
  let q2 = q;
  if (rem * 2n >= d) q2 = q + 1n;
  let s = q2.toString().padStart(maxFracDigits + 1, "0");
  let intPart = s.slice(0, s.length - maxFracDigits);
  let fracPart = maxFracDigits ? s.slice(-maxFracDigits) : "";
  fracPart = fracPart.replace(/0+$/, "");
  const body = fracPart ? `${intPart}.${fracPart}` : intPart;
  return (neg ? "-" : "") + body;
}

/** Floor for positive rationals (BigInt division). */
export function floorDiv(a: bigint, b: bigint): bigint {
  // a, b positive
  return a / b;
}
