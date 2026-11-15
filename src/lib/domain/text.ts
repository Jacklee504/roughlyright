/**
 * Comparison-key normalisation for target-match datasets and guess matching.
 * NFKC → case folding → diacritic removal → punctuation handling → collapsed whitespace.
 */

export function normalizeKey(input: string): string {
  let s = input.normalize("NFKC").toLowerCase();
  // remove diacritics
  s = s.normalize("NFD").replace(/\p{M}+/gu, "").normalize("NFC");
  // collapse common punctuation (articles, ampersands, apostrophes, hyphens, dots) to spaces
  s = s.replace(/[’'`´]/g, "");
  s = s.replace(/[^a-z0-9]+/g, " ");
  return s.trim().replace(/\s+/g, " ");
}

/** Trims a leading leading article for display-invariant sorting and matching. */
export function stripArticle(key: string): string {
  return key.replace(/^(the|a|an) /, "");
}
