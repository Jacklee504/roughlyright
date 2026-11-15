/**
 * Number parser — v1 rules.
 *
 * Grammar: English-formatted positive decimals, in the question's unit.
 * - `5000`, `5,000`, `5 000`, `.5`, `0.5`, `1.25`
 * - Suffixes (case-insensitive): k|thousand ×10³, m|million ×10⁶, b|billion ×10⁹, t|trillion ×10¹²
 * - A suffix scales the number in the displayed answer unit.
 * - Rejects: negative (incl. en/em dash), zero, scientific notation, arithmetic,
 *   appended unit strings, malformed grouping, mixed grouping separators, decimal commas.
 * - Raw input length cap: 64 characters. Supported range: 1e-9 .. 1e15 inclusive.
 *
 * The same function powers the client preview and server validation;
 * the server is authoritative.
 */

import { parseDecimalToRat, rat, type Rat } from "./decimal";

export const MAX_RAW_LENGTH = 64;
export const MIN_SUPPORTED_EXP = -9; // 1e-9 inclusive
export const MAX_SUPPORTED_EXP = 15; // 1e15 inclusive
export const MAX_FRACTIONAL_DIGITS = 9;

export type ParseMode = "measured" | "count";

export type ParseOk = {
  ok: true;
  value: Rat; // exact rational value in the answer unit
  canonical: string; // plain decimal string, no grouping
  isInteger: boolean;
};

export type ParseErr = {
  ok: false;
  code:
    | "empty"
    | "too_long"
    | "not_a_number"
    | "bad_grouping"
    | "negative"
    | "zero"
    | "out_of_range"
    | "too_precise"
    | "not_whole"
    | "unit_string";
  message: string;
};

export type ParseResult = ParseOk | ParseErr;

const SUFFIXES: Record<string, number> = {
  k: 1,
  thousand: 1,
  m: 2,
  million: 2,
  b: 3,
  billion: 3,
  t: 4,
  trillion: 4,
};

function friendly(code: ParseErr["code"], unit: string): string {
  const example = "Enter a positive number in {unit}, like 900 or 1.2k.";
  switch (code) {
    case "empty":
      return "Enter a number to lock your guess.";
    case "too_long":
      return "That is too long. Keep the guess under 64 characters — you can use k, m, b for large numbers.";
    case "not_a_number":
      return example.replace("{unit}", unit);
    case "bad_grouping":
      return "Check the thousands separators — use groups of three, like 5,000 or 5 000, and don't mix separators.";
    case "negative":
      return "Guesses must be positive numbers in this game. Enter the amount without a minus sign.";
    case "zero":
      return "Zero isn't a valid guess here. Enter a positive number.";
    case "out_of_range":
      return "That value is outside the supported range (1e-9 to 1e15 in the answer unit).";
    case "too_precise":
      return "That is more precise than the game supports — use at most 9 decimal places.";
    case "not_whole":
      return "This is a count, so enter a positive whole number (5,000 or 5k, not 5.5).";
    case "unit_string":
      return `Leave the unit out — the field already means ${unit}. For example: 900 or 1.2k.`;
  }
}

function fail(code: ParseErr["code"], unit: string): ParseErr {
  return { ok: false, code, message: friendly(code, unit) };
}

/** Normalise exotic Unicode whitespace (incl. NBSP) to plain spaces; trim. */
function normalizeWhitespace(s: string): string {
  return s.replace(/[\p{Zs}\t]+/gu, " ").trim();
}

/** Split off a trailing suffix; returns null if the tail is not a valid suffix. */
function splitSuffix(s: string): { body: string; group: number } | null {
  const m = /^(.*?)(?:\s*)?(k|thousand|m|million|b|billion|t|trillion)?$/i.exec(s)!;
  const body = m[1].trim();
  const suffix = m[2] ? m[2].toLowerCase() : null;
  if (!suffix) {
    // No suffix captured; body must be the whole string.
    return { body, group: 0 };
  }
  if (body.length === 0) return null; // bare suffix like "k" alone
  return { body, group: SUFFIXES[suffix] };
}

/**
 * Validate integer part grouping for a single separator, returning plain digits.
 * Rules: optional groups of exactly three digits after the first 1–3 digits;
 * no empty groups; no leading separator.
 */
function stripGrouping(intPart: string, sep: string): string | null {
  if (sep === "") {
    return /^\d*$/.test(intPart) ? intPart : null;
  }
  const esc = sep === "," ? "\\," : " ";
  const re = new RegExp(`^\\d{1,3}(?:${esc}\\d{3})*$`);
  if (!re.test(intPart)) return null;
  return intPart.split(sep).join("");
}

export function parseNumber(raw: string, mode: ParseMode, unit: string): ParseResult {
  const trimmed = raw.trim();
  if (trimmed.length === 0) return fail("empty", unit);
  if (trimmed.length > MAX_RAW_LENGTH) return fail("too_long", unit);

  const s = normalizeWhitespace(trimmed);
  if (s.length === 0) return fail("empty", unit);

  // Fast rejection of characters outside the grammar (signs incl. dashes,
  // scientific notation, arithmetic, parentheses).
  if (!/^[\d., a-zA-Z]+$/.test(s)) {
    if (/[+\-−–—]/.test(s)) return fail("negative", unit);
    if (/[eE]/.test(s)) return fail("not_a_number", unit);
    return fail("not_a_number", unit);
  }
  if (/[+\-−–—]/.test(s)) return fail("negative", unit);
  if (/[eE]/.test(s)) return fail("not_a_number", unit);

  const split = splitSuffix(s);
  if (!split) return fail("not_a_number", unit);
  let numPart = split.body;
  const group = split.group;

  // Leftover letters inside the number body mean an appended unit string.
  if (/[a-zA-Z]/.test(numPart)) return fail("unit_string", unit);

  const dotCount = (numPart.match(/\./g) || []).length;
  if (dotCount > 1) return fail("bad_grouping", unit);
  if (numPart.endsWith(".")) return fail("bad_grouping", unit);

  const sep = numPart.includes(",") ? "," : numPart.includes(" ") ? " " : "";
  const hasBoth = numPart.includes(",") && numPart.includes(" ");
  if (hasBoth) return fail("bad_grouping", unit);

  let intPart = numPart;
  let fracPart = "";
  if (dotCount === 1) {
    const idx = numPart.indexOf(".");
    intPart = numPart.slice(0, idx);
    fracPart = numPart.slice(idx + 1);
    if (!/^\d*$/.test(fracPart)) return fail("bad_grouping", unit);
  }
  const intDigits = stripGrouping(intPart, sep);
  if (intDigits === null) return fail("bad_grouping", unit);
  if (intDigits === "" && fracPart === "") return fail("empty", unit);

  const digitsOnly = `${intDigits}.${fracPart}`;
  const mantissa = parseDecimalToRat(digitsOnly);
  if (!mantissa) return fail("not_a_number", unit);

  if (mantissa.n === 0n) return fail("zero", unit);

  // Expand the suffix (keep the rational reduced).
  const value: Rat = group > 0 ? rat(mantissa.n * 10n ** BigInt(3 * group), mantissa.d) : mantissa;

  // Range check, inclusive: 1e-9 .. 1e15.
  if (cmpPow10(value, MIN_SUPPORTED_EXP) < 0 || cmpPow10(value, MAX_SUPPORTED_EXP) > 0) {
    return fail("out_of_range", unit);
  }

  // Fractional digits after expansion ≤ 9.
  const dDigits = mantissa.d.toString().length - 1; // d is a power of 10
  const fracDigits = Math.max(0, dDigits - 3 * group);
  if (fracDigits > MAX_FRACTIONAL_DIGITS) return fail("too_precise", unit);

  if (mode === "count" && value.d !== 1n) return fail("not_whole", unit);

  return {
    ok: true,
    value,
    canonical: canonicalString(value),
    isInteger: value.d === 1n,
  };
}

/** Is a positive rational inside the supported guess/benchmark range (1e-9..1e15 inclusive)? */
export function inSupportedRange(v: Rat): boolean {
  return cmpPow10(v, MIN_SUPPORTED_EXP) >= 0 && cmpPow10(v, MAX_SUPPORTED_EXP) <= 0;
}

/** Compare a positive rational against 10^exp. */
function cmpPow10(v: Rat, exp: number): number {
  if (exp >= 0) {
    const r = v.d * 10n ** BigInt(exp);
    return v.n < r ? -1 : v.n > r ? 1 : 0;
  }
  const l = v.n * 10n ** BigInt(-exp);
  return l < v.d ? -1 : l > v.d ? 1 : 0;
}

/** Plain decimal canonical string (no grouping, no trailing zeros). */
export function canonicalString(v: Rat): string {
  if (v.d === 1n) return v.n.toString();
  let x = v.n;
  let frac = "";
  let rem = x % v.d;
  x = x / v.d;
  let guard = 0;
  while (rem !== 0n && guard < 64) {
    rem *= 10n;
    const digit = rem / v.d;
    frac += digit.toString();
    rem = rem % v.d;
    guard++;
  }
  if (rem !== 0n) {
    const approx = Number(v.n) / Number(v.d);
    return approx.toString();
  }
  return frac ? `${x}.${frac}` : `${x}`;
}

/** Format a canonical value with thousands grouping for display. */
export function formatDisplay(canonical: string): string {
  const neg = canonical.startsWith("-");
  const body = neg ? canonical.slice(1) : canonical;
  const [int, frac] = body.split(".");
  const grouped = int.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return (neg ? "-" : "") + grouped + (frac ? "." + frac : "");
}
