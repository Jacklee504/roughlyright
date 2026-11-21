import { describe, expect, it } from "vitest";
import {
  PREMIERE, SHOW_FACTS, accumulateScore, decodeEpisode, factAmount, finishShow, makeEpisode,
  maxWager, readShowRecord, scoreShowRound, type Episode, type ShowPick, type ShowResult,
} from "@/lib/domain/close-call";

function run(episode: Episode, choose: (round: Episode["rounds"][number], score: ReturnType<typeof accumulateScore>) => ShowPick) {
  const results: ShowResult[] = [];
  for (const round of episode.rounds) {
    const score = accumulateScore(results);
    results.push(scoreShowRound(round, choose(round, score), score)!);
  }
  return { results, score: accumulateScore(results) };
}

describe("Close Call episodes", () => {
  it("replays every fact, position and House decision from a challenge code", () => {
    expect(decodeEpisode(PREMIERE.code)).toEqual(PREMIERE);
    expect(PREMIERE.rounds.map(({ kind }) => kind)).toEqual(["estimate", "estimate", "direction", "window", "final"]);
    expect(new Set(PREMIERE.rounds.map(({ fact }) => fact.category)).size).toBe(5);
    expect(decodeEpisode("premiere.saturn-v-height.eiffel-rivets.hummingbird.hummingbird.marathon-distance")).toBeNull();
    expect(decodeEpisode("premiere.missing.eiffel-rivets.hummingbird.challenger-deep.marathon-distance")).toBeNull();
    expect(decodeEpisode("!!!.saturn-v-height.eiffel-rivets.hummingbird.challenger-deep.marathon-distance")).toBeNull();
  });

  it("keeps stable unique fact IDs and creates a disjoint, mixed rematch", () => {
    expect(new Set(SHOW_FACTS.map(({ id }) => id)).size).toBe(SHOW_FACTS.length);
    expect(SHOW_FACTS.filter(({ id }) => id.startsWith("close-call-")).length).toBeGreaterThanOrEqual(12);
    const previous = PREMIERE.rounds.map(({ fact }) => fact.id);
    const next = makeEpisode(previous, () => 0.62);
    expect(next.rounds.every(({ fact }) => !previous.includes(fact.id))).toBe(true);
    expect(new Set(next.rounds.map(({ fact }) => fact.category)).size).toBe(5);
    expect(decodeEpisode(next.code)).toEqual(next);
  });

  it("finishes a loss, then lets a better second match win", () => {
    const loss = run(PREMIERE, (round, score) => {
      const guess = factAmount(round.fact.value * 20);
      if (round.kind === "direction") return { kind: "direction", direction: round.fact.value > round.benchmark ? "lower" : "higher" };
      if (round.kind === "window") return { kind: "window", guess, band: 0 };
      if (round.kind === "final") return { kind: "final", guess, wager: maxWager(score) };
      return { kind: "estimate", guess };
    });
    expect(loss.score.you).toBeLessThan(loss.score.house);
    expect(loss.results.at(-1)!.transfer).toBeLessThan(0);
    const record = finishShow(readShowRecord(null), loss.score);
    expect(record).toMatchObject({ played: 1, wins: 0, streak: 0 });

    const rematch = makeEpisode(PREMIERE.rounds.map(({ fact }) => fact.id), () => 0.38);
    const win = run(rematch, (round, score) => {
      const guess = factAmount(round.fact.value);
      if (round.kind === "direction") return { kind: "direction", direction: round.fact.value > round.benchmark ? "higher" : "lower" };
      if (round.kind === "window") return { kind: "window", guess, band: 0 };
      if (round.kind === "final") return { kind: "final", guess, wager: maxWager(score) };
      return { kind: "estimate", guess };
    });
    expect(win.score.you).toBeGreaterThan(win.score.house);
    expect(finishShow(record, win.score)).toMatchObject({ played: 2, wins: 1, streak: 1, best: win.score.you });
  });
});

describe("Close Call round rules", () => {
  it("prices the width of a successful range and includes boundaries", () => {
    const round = PREMIERE.rounds[3]!;
    const score = { you: 50, house: 50 };
    const edge = factAmount(round.fact.value * 1.25);
    const miss = factAmount(round.fact.value * 1.3);
    expect(scoreShowRound(round, { kind: "window", guess: edge, band: 0 }, score)?.base.you).toBe(100);
    expect(scoreShowRound(round, { kind: "window", guess: miss, band: 0 }, score)?.base.you).toBe(0);
    expect(scoreShowRound(round, { kind: "window", guess: miss, band: 2 }, score)?.base.you).toBe(50);
  });

  it("lets the final wager reverse a deficit and disallows wagers above either score", () => {
    const round = PREMIERE.rounds[4]!;
    const trailing = { you: 130, house: 285 };
    const guess = factAmount(round.fact.value);
    const lock = scoreShowRound(round, { kind: "final", guess, wager: 100 }, trailing)!;
    expect(lock.transfer).toBe(100);
    expect(trailing.you + lock.base.you).toBeLessThan(trailing.house + lock.base.house);
    expect(trailing.you + lock.change.you).toBeGreaterThan(trailing.house + lock.change.house);
    expect(scoreShowRound(round, { kind: "final", guess, wager: 101 }, trailing)).toBeNull();
    expect(scoreShowRound(round, { kind: "final", guess, wager: 18 }, { you: 18, house: 17 })).toBeNull();
  });

  it("keeps the stake on both scores when the two guesses are equally close", () => {
    const round = PREMIERE.rounds[4]!;
    if (round.kind !== "final") throw new Error("Missing final round");
    const result = scoreShowRound(round, { kind: "final", guess: factAmount(round.houseGuess), wager: 80 }, { you: 100, house: 100 });
    expect(result?.transfer).toBe(0);
    expect(result?.change.you).toBe(result?.change.house);
  });

  it("recovers from invalid browser records", () => {
    expect(readShowRecord("bad!")).toEqual({ played: 0, wins: 0, streak: 0, best: 0 });
    expect(readShowRecord('{"played":4,"wins":3,"streak":2,"best":531}')).toMatchObject({ wins: 3, best: 531 });
    expect(readShowRecord('{"played":1,"wins":3,"streak":2,"best":531}')).toMatchObject({ wins: 0 });
  });
});
