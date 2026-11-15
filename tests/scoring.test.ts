import { describe, expect, it } from "vitest";
import { parseDecimalToRat, ratToString } from "@/lib/domain/decimal";
import { scoreValue } from "@/lib/domain/scoring";

function g(s: string) {
  const v = parseDecimalToRat(s);
  if (!v) throw new Error(`bad test value ${s}`);
  return v;
}

/** Every row of the published scoring table in the handoff document. */
const TABLE: [string, string, number, string][] = [
  ["100", "100", 100, "Exact"],
  ["100", "100.4", 100, "Close"],
  ["100", "80", 80, "In range"],
  ["100", "125", 80, "In range"],
  ["100", "50", 50, "In range"],
  ["100", "200", 50, "In range"],
  ["100", "10", 10, "Far"],
  ["100", "0.5", 1, "Far"],
  ["100", "0.49", 0, "Far"],
];

describe("scoring contract", () => {
  it.each(TABLE)("target %s, guess %s -> %i points, %s", (target, guess, points, mark) => {
    // Columns: table lists "Benchmark | Guess" — try both orientations; the
    // formula is symmetric, so rows hold either way.
    const scored = scoreValue(g(guess), g(target));
    expect(scored.points).toBe(points);
    expect(scored.mark).toBe(mark);
    const flipped = scoreValue(g(target), g(guess));
    expect(flipped.points).toBe(points);
    expect(flipped.mark).toBe(mark);
  });

  it("exact only by numeric equality", () => {
    expect(scoreValue(g("100"), g("100")).mark).toBe("Exact");
    expect(scoreValue(g("100"), g("100.0")).mark).toBe("Exact");
    expect(scoreValue(g("100"), g("100.000001")).mark).toBe("Close");
    expect(scoreValue(g("100"), g("100.000001")).points).toBe(100);
  });

  it("rounds half-up at .5", () => {
    // ratio 0.985 -> 98.5 -> floor(98.5+0.5)=99? floor(99.0)=99
    const scored = scoreValue(g("100"), g("101.523809523")); // 100/101.5238 ≈ 0.984999…
    expect(scored.points).toBe(Math.floor((100 * 100) / 101.523809523 + 0.5));
  });

  it("half/double symmetry", () => {
    for (const x of ["3", "7", "100", "0.75", "12345.678"]) {
      const a = scoreValue(g(x), g(String(Number(x) / 2)));
      const b = scoreValue(g(x), g(String(Number(x) * 2)));
      expect(a.points).toBe(b.points);
      expect(a.mark).toBe(b.mark);
      expect(a.points).toBe(50);
      expect(a.mark).toBe("In range");
    }
  });

  it("band thresholds", () => {
    // ratio 0.9 exactly -> Close
    expect(scoreValue(g("100"), g("111.111111111111111")).points).toBe(90);
    // ratio just below 0.9 -> In range
    expect(scoreValue(g("100"), g("111.12")).mark).toBe("In range");
    // ratio 0.5 exactly -> In range
    expect(scoreValue(g("100"), g("200")).mark).toBe("In range");
    // ratio just below 0.5 -> Far
    expect(scoreValue(g("100"), g("200.1")).mark).toBe("Far");
  });

  it("expands exact decimals for display", () => {
    expect(ratToString(g("35162.5"))).toBe("35162.5");
    expect(ratToString(g("3300000"))).toBe("3300000");
    expect(ratToString(g("0.0049"))).toBe("0.0049");
  });
});
