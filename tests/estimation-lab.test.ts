import { describe, expect, it } from "vitest";
import { parseDecimalToRat, ratToString } from "@/lib/domain/decimal";
import { LAB_CASES, LAB_MAX_SCORE, evaluateLabCase, projectLabCase, readLabBests } from "@/lib/domain/estimation-lab";

const rain = LAB_CASES.find(({ id }) => id === "stadium-rain")!;
const moon = LAB_CASES.find(({ id }) => id === "moon-road-trip")!;
const values = (...guesses: string[]) => guesses.map((guess) => parseDecimalToRat(guess)!);

describe("Estimation Lab", () => {
  it.each([
    ["stadium-rain", "178500"],
    ["moon-road-trip", "480.5"],
    ["cash-cube", "1.13256"],
    ["marathon-steps", "41773.05"],
    ["library-lights", "399.36"],
  ])("calculates the reference total and full points for %s", (id, expected) => {
    const labCase = LAB_CASES.find((candidate) => candidate.id === id)!;
    const reported = evaluateLabCase(labCase, values(...labCase.factors.map(({ reference }) => reference)));
    expect(ratToString(reported.model, 7)).toBe(expected);
    expect(reported.points).toBe(LAB_MAX_SCORE);
    expect(reported.weakest).toBeNull();
  });

  it("scores both individual assumptions and the combined estimate", () => {
    const result = evaluateLabCase(rain, values("105", "68", "50"));
    expect(ratToString(result.projected)).toBe("357000");
    expect(result.total.points).toBe(50);
    expect(result.points).toBe(350);
    expect(result.weakest).toBe(2);
    expect(result.opposingErrors).toBe(false);
  });

  it("reveals offsetting errors and shows the effect of replacing one denominator", () => {
    const guesses = values("768800", "200", "8");
    const result = evaluateLabCase(moon, guesses);
    expect(result.total.points).toBe(100);
    expect(result.points).toBe(400);
    expect(result.opposingErrors).toBe(true);
    expect(ratToString(projectLabCase(moon, [guesses[0]!, result.references[1]!, guesses[2]!]))).toBe("961");
  });

  it("filters obsolete and invalid local bests without throwing on corrupt saves", () => {
    expect(readLabBests('{"stadium-rain":350,"moon-road-trip":0,"cash-cube":501,"marathon-steps":"42","obsolete":300}'))
      .toEqual({ "stadium-rain": 350, "moon-road-trip": 0 });
    expect(readLabBests('{"stadium-')).toEqual({});
  });
});
