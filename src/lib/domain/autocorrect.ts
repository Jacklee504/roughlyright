/**
 * Autocorrect for guess inputs. Purely advisory: the corrected value is always
 * offered back to the player ("Did you mean …?") and never applied silently,
 * and the server re-validates whatever is finally submitted.
 */

import { parseNumber, type ParseMode } from "./numberParser";

export type Repair = { fixed: string; canonical: string };

/**
 * Attempt to repair a rejected numeric guess. Returns the first repaired
 * candidate that the official parser accepts, or null when nothing plausible
 * was found. Repairs cover: exotic Unicode digits, lookalike letters
 * (O→0, l/I→1), currency symbols and wrapping words ("about 900", "~2
 * million"), appended unit strings ("900 kg"), stray punctuation, broken
 * grouping ("1.234.567", "3,50,000", "1'000", "9 00"), doubled decimal
 * points ("5..0"), and the decimal-comma vs thousands-comma ambiguity
 * ("5,00"), resolved per mode.
 */
export function repairNumberInput(raw: string, mode: ParseMode, unit: string): Repair | null {
  const original = raw.trim();
  if (!original || original.length > 64) return null;
  if (parseNumber(original, mode, unit).ok) return null; // already valid; nothing to fix

  const seen = new Set<string>();
  const tryCandidate = (candidate: string): Repair | null => {
    const c = candidate.trim();
    if (!c || c.length > 64 || seen.has(c)) return null;
    seen.add(c);
    const parsed = parseNumber(c, mode, unit);
    if (parsed.ok) return { fixed: c, canonical: parsed.canonical };
    return null;
  };

  // Stage 1: strip wrapping prose/currency, then collect candidate cores.
  // Lookalike letters are only mapped inside digit-bearing tokens, so words
  // like "about" or "hello" are never mangled into numbers.
  const wordStripped = stripDecorations(original, unit);
  const bases = [wordStripped, ...numberTokens(wordStripped), ...numberTokens(original)];

  // Stage 2: each core, then structural repairs, tried in order of intent.
  for (const base of bases) {
    const hit = tryCandidate(base);
    if (hit) return hit;
    for (const variant of structuralVariants(base, mode)) {
      const hit2 = tryCandidate(variant);
      if (hit2) return hit2;
    }
  }
  return null;
}

/** Map non-ASCII digit systems to 0-9 (common blocks only; others are left as-is). */
function normalizeDigits(s: string): string {
  return s.replace(/\p{Nd}/gu, (d) => {
    const v = d.codePointAt(0)!;
    if (v >= 0x30 && v <= 0x39) return d; // ASCII
    if (v >= 0x660 && v <= 0x669) return String(v - 0x660); // Arabic-Indic
    if (v >= 0x6f0 && v <= 0x6f9) return String(v - 0x6f0); // Extended Arabic-Indic
    if (v >= 0x966 && v <= 0x96f) return String(v - 0x966); // Devanagari
    if (v >= 0x9e6 && v <= 0x9ef) return String(v - 0x9e6); // Bengali
    if (v >= 0xe50 && v <= 0xe59) return String(v - 0xe50); // Thai
    if (v >= 0xff10 && v <= 0xff19) return String(v - 0xff10); // Full-width
    return d; // unknown digit system: leave for the parser to reject
  });
}

/** Common lookalike letters inside what should be digits. */
function mapConfusables(s: string): string {
  return s.replace(/[Ooº°]/g, "0").replace(/[lI|!]/g, "1");
}

/** Remove currency/wrapping noise; keep the numeric core. */
function stripDecorations(s: string, unit: string): string {
  let t = s.trim();
  // Leading intent words and approx markers.
  t = t.replace(/^(?:about|approx(?:imately)?|around|roughly|circa|nearly|just over|just under|almost|some|maybe|perhaps|est\.?|estimate[: ]*|guess[: ]*|answer[: ]*|is)\b[\s:,-]*/i, "");
  t = t.replace(/^[~≈≈=+#»"“'\s]+/, "").replace(/[~≈=+#«"”'\s]+$/, "");
  // Currency symbols and codes anywhere.
  t = t.replace(/(?:[$€£¥₹]|\b(?:usd|eur|gbp|inr)\b)/gi, " ");
  // Appended or embedded unit string ("900 kg", "900kg", "900 kgs", "kg 900").
  const escUnit = unit.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  if (escUnit) {
    t = t.replace(new RegExp(`\\b${escUnit}s?\\b`, "gi"), " ");
    // glued forms without a boundary on the digit side: "900kg"
    t = t.replace(new RegExp(`(?<=\\d)${escUnit}s?\\b`, "gi"), " ");
  }
  // Trailing sentence punctuation.
  t = t.replace(/[.,;:!?\-–—]+$/, "");
  return t.replace(/\s+/g, " ").trim();
}

/**
 * Digit-bearing tokens inside leftover prose, with confusable letters mapped.
 * A token must contain at least one real digit (any script), so words made
 * only of lookalike letters ("hello") are never turned into numbers.
 */
function numberTokens(s: string): string[] {
  const re =
    /[\p{Nd}OoIil|!º°][\p{Nd}OoIil|!º°.,'\u00A0 ]*(?:k|m|b|t|thousand|million|billion|trillion)?/giu;
  const out: string[] = [];
  for (const m of s.matchAll(re)) {
    let tok = m[0].replace(/[\u00A0]+/g, " ").trim();
    tok = tok.replace(/[.,' ]+$/, "");
    if (!tok || !/\p{Nd}/u.test(tok)) continue;
    out.push(mapConfusables(normalizeDigits(tok)));
  }
  return out;
}

/**
 * Structural variants of a cleaned token, in the order they should be tried.
 * The first candidate the official parser accepts wins.
 */
function structuralVariants(base: string, mode: ParseMode): string[] {
  const out: string[] = [];
  const push = (v: string | null) => {
    if (v && v.trim()) out.push(v.trim());
  };

  const hasComma = base.includes(",");
  const hasDot = base.includes(".");
  const hasSpace = / /.test(base);
  const commaCount = (base.match(/,/g) || []).length;
  const dotCount = (base.match(/\./g) || []).length;

  // Doubled/stray decimal points: "5..0" → "5.0"; trailing dot: "900." → "900".
  if (dotCount >= 1 && /\.{2,}|^\D*\.|\.$/.test(base)) {
    push(base.replace(/\.{2,}/g, ".").replace(/^[.\s]+/, "").replace(/\.$/, ""));
    push(base.replace(/\./g, ""));
  }

  // European-style grouped dots: "1.234.567" → "1234567" (all groups of 3).
  if (dotCount >= 2) {
    const groups = base.split(".");
    if (groups.slice(1).every((g) => g.length === 3) && groups[0].length <= 3) {
      push(groups.join(""));
    }
  }

  // Mixed/comma grouping problems: "1,23,456", "5,00000", "9 00", "1'000".
  if (commaCount >= 1 || hasSpace || base.includes("'")) {
    const cleaned = base.replace(/[, '\u00A0]/g, "");
    // Decimal comma ("5,00" → "5.00"): only meaningful with one comma and a
    // short trailing group. Measured quantities usually mean a decimal comma
    // (European input); counts need whole numbers, so the thousands reading
    // ("500") is tried first there and the decimal reading afterwards.
    const singleComma = commaCount === 1 && !hasSpace && !base.includes("'");
    const tail = singleComma ? base.slice(base.lastIndexOf(",") + 1) : "";
    const decimal = base.replace(/,/g, ".");
    if (singleComma && (/^\d{1,2}(\D.*)?$/.test(tail) || tail === "")) {
      if (mode === "measured") push(decimal);
      push(cleaned);
      if (mode !== "measured") push(decimal);
    } else {
      push(cleaned);
    }
  }

  // Last resort: strip every separator from whatever remains.
  if (out.length === 0 && (hasComma || hasSpace || hasDot || base.includes("'"))) {
    push(base.replace(/[,.'\u00A0 ]/g, ""));
  }

  return out;
}

// ---------------------------------------------------------------------------
// Fuzzy entity matching (target match)
// ---------------------------------------------------------------------------

export type FuzzyCandidate = { display: string; entryKey: string };

/** Levenshtein distance (classic DP; candidate lists are small). */
export function editDistance(a: string, b: string): number {
  if (a === b) return 0;
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  let prev = new Array<number>(n + 1);
  let curr = new Array<number>(n + 1);
  for (let j = 0; j <= n; j++) prev[j] = j;
  for (let i = 1; i <= m; i++) {
    curr[0] = i;
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost);
    }
    [prev, curr] = [curr, prev];
  }
  return prev[n];
}

/** Typo tolerance scales with the length of the typed key. */
export function fuzzyThreshold(keyLen: number): number {
  if (keyLen < 3) return 0;
  if (keyLen <= 5) return 1;
  if (keyLen <= 12) return 2;
  return 3;
}

/**
 * Rank candidates by normalised edit distance against the typed text.
 * Returns only candidates within the typo threshold, best first
 * (distance, then alphabetical). Empty when nothing is close enough.
 */
export function fuzzyEntityMatches(
  typed: string,
  candidates: FuzzyCandidate[],
  normalize: (s: string) => string,
): { candidate: FuzzyCandidate; distance: number }[] {
  const key = normalize(typed);
  if (key.length < 3) return [];
  const threshold = fuzzyThreshold(key.length);
  const hits: { candidate: FuzzyCandidate; distance: number; sortKey: string }[] = [];
  for (const c of candidates) {
    const ck = normalize(c.display);
    if (ck === key) continue; // exact matches are not autocorrect business
    const d = editDistance(key, ck);
    if (d <= threshold) hits.push({ candidate: c, distance: d, sortKey: ck });
  }
  hits.sort((a, b) => a.distance - b.distance || (a.sortKey < b.sortKey ? -1 : 1));
  return hits.map(({ candidate, distance }) => ({ candidate, distance }));
}
