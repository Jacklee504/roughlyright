import { describe, expect, it } from "vitest";
import { parseNumber } from "../src/lib/domain/numberParser";
import { makeWarmup } from "../src/lib/domain/warmup";

describe("warm-up sets", () => {
  it("draws five scenarios and changes every scenario on immediate replay", () => {
    const first = makeWarmup([], () => 0);
    expect(new Set(first.map((round) => round.scenario)).size).toBe(5);

    const next = makeWarmup(first.map((round) => round.scenario), () => 0);
    expect(next).toHaveLength(5);
    expect(next.every((round) => !first.some((previous) => previous.scenario === round.scenario))).toBe(true);
  });

  it("generates benchmarks the same guess parser accepts", () => {
    let seed = 42;
    const random = () => {
      seed = (Math.imul(seed, 1_664_525) + 1_013_904_223) >>> 0;
      return seed / 2 ** 32;
    };
    for (let i = 0; i < 70; i++) {
      for (const round of makeWarmup([], random)) {
        const parsed = parseNumber(String(round.answer), round.countMode ? "count" : "measured", round.unit);
        expect(parsed.ok, round.prompt).toBe(true);
      }
    }
  });
});
