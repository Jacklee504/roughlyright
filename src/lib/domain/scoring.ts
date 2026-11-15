/**
 * Scoring contract v1.
 *
 *   ratioClose  = min(g,t) / max(g,t)
 *   rawPoints   = 100 × ratioClose
 *   points      = floor(rawPoints + 0.5)
 *   errorFactor = max(g,t) / min(g,t)
 *
 * Marks classify by the UNROUNDED ratio; Exact is numeric equality.
 * All arithmetic is exact (BigInt rationals).
 */

import { cmp, div, eq, type Rat } from "./decimal";

export type Mark = "Exact" | "Close" | "In range" | "Far" | "Pass";

export type Scored = {
  points: number; // 0..100
  mark: Mark;
  ratioClose: Rat; // unrounded
  errorFactor: Rat; // unrounded, undefined for equal values
};

export function scoreValue(guess: Rat, target: Rat): Scored {
  if (eq(guess, target)) {
    return { points: 100, mark: "Exact", ratioClose: { n: 1n, d: 1n }, errorFactor: { n: 1n, d: 1n } };
  }
  const [min, max] = cmp(guess, target) < 0 ? [guess, target] : [target, guess];
  const ratioClose = div(min, max);
  const errorFactor = div(max, min);
  // points = floor(100 * ratioClose + 1/2)
  const scaled = ratioClose.n * 100n;
  const points = Number((2n * scaled + ratioClose.d) / (2n * ratioClose.d));
  const mark = markForRatio(ratioClose);
  return { points, mark, ratioClose, errorFactor };
}

/** Direction of a guess relative to a target: "high" | "low". */
export function direction(guess: Rat, target: Rat): "high" | "low" {
  return cmp(guess, target) > 0 ? "high" : "low";
}

function markForRatio(ratio: Rat): Exclude<Mark, "Exact" | "Pass"> {
  // Close:   0.90 ≤ ratio < 1
  // In range: 0.50 ≤ ratio < 0.90
  // Far:     ratio < 0.50
  if (ratio.n * 10n >= 9n * ratio.d) return "Close";
  if (ratio.n * 2n >= ratio.d) return "In range";
  return "Far";
}

export function markLabel(mark: Mark): string {
  switch (mark) {
    case "Exact":
      return "Exact";
    case "Close":
      return "Close";
    case "In range":
      return "In range";
    case "Far":
      return "Far";
    case "Pass":
      return "Pass";
  }
}
