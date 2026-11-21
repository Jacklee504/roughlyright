import { cmp, div, mul, parseDecimalToRat, rat, type Rat } from "./decimal";
import { scoreValue } from "./scoring";
import { SCALE_FACTS } from "./scale-run";
import type { ScaleFact } from "./scale-facts";
import { CLOSE_CALL_FACTS } from "./close-call-facts";

export const SHOW_RECORD_KEY = "rr_close_call_v1";
export const LAST_WAGER = 100;
export const ROUND_NAMES = ["Opening bid", "Second shot", "High or low", "The window", "Final wager"] as const;
export const RANGE_BANDS = [
  { label: "Tight", factor: rat(5n, 4n), points: 100 },
  { label: "Even", factor: rat(8n, 5n), points: 75 },
  { label: "Wide", factor: rat(9n, 4n), points: 50 },
] as const;

type Direction = "higher" | "lower";
type Exact = { kind: "estimate" | "final"; fact: ScaleFact; houseGuess: number };
type HighLow = { kind: "direction"; fact: ScaleFact; benchmark: number; houseCall: Direction };
type Window = { kind: "window"; fact: ScaleFact; houseGuess: number; houseBand: number };
export type ShowRound = Exact | HighLow | Window;
export type ShowPick =
  | { kind: "estimate"; guess: Rat }
  | { kind: "direction"; direction: Direction }
  | { kind: "window"; guess: Rat; band: number }
  | { kind: "final"; guess: Rat; wager: number };
export type Scoreboard = { you: number; house: number };
export type ShowResult = {
  base: Scoreboard;
  change: Scoreboard;
  transfer: number;
  pick: ShowPick;
};
export type Episode = { code: string; rounds: ShowRound[] };
export type ShowRecord = { played: number; wins: number; streak: number; best: number };

export const SHOW_FACTS = [...SCALE_FACTS, ...CLOSE_CALL_FACTS];
const byId = new Map(SHOW_FACTS.map((fact) => [fact.id, fact]));
const houseSkill = [53, 58, 63, 68, 72, 75, 80, 86, 91];
const blankRecord: ShowRecord = { played: 0, wins: 0, streak: 0, best: 0 };
const firstCode = "premiere.close-call-crown-climb.close-call-elephant-trunk.close-call-neptune-orbit.challenger-deep.marathon-distance";

export function factAmount(value: number): Rat {
  return parseDecimalToRat(value.toLocaleString("en-US", { useGrouping: false, maximumFractionDigits: 20 }))!;
}

function seededDraw(key: string) {
  let state = 2166136261;
  for (const char of key) state = Math.imul(state ^ char.charCodeAt(0), 16777619) >>> 0;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 2 ** 32;
  };
}

function buildRound(fact: ScaleFact, index: number, seed: string): ShowRound {
  const draw = seededDraw(`${seed}/${fact.id}/${index}`);
  const tooHigh = draw() < 0.5;
  const accuracy = houseSkill[Math.floor(draw() * houseSkill.length)]! / 100;
  const houseGuess = Number((tooHigh ? fact.value / accuracy : fact.value * accuracy).toPrecision(3));
  if (index === 2) {
    const actual: Direction = fact.value > houseGuess ? "higher" : "lower";
    const other: Direction = actual === "higher" ? "lower" : "higher";
    return { kind: "direction", fact, benchmark: houseGuess, houseCall: draw() < 0.58 ? actual : other };
  }
  if (index === 3) return { kind: "window", fact, houseGuess, houseBand: Math.floor(draw() * RANGE_BANDS.length) };
  return { kind: index === 4 ? "final" : "estimate", fact, houseGuess };
}

export function decodeEpisode(code: string | undefined): Episode | null {
  if (!code || code.length > 280) return null;
  const [seed, ...ids] = code.split(".");
  if (!seed || !/^[a-z0-9]{4,10}$/.test(seed) || ids.length !== ROUND_NAMES.length || new Set(ids).size !== ids.length) return null;
  const facts = ids.map((id) => byId.get(id));
  if (!facts.every((fact) => fact !== undefined)) return null;
  return { code, rounds: facts.map((fact, index) => buildRound(fact, index, seed)) };
}

export const PREMIERE = decodeEpisode(firstCode)!;

/** Choose fresh facts, spreading the five rounds across as many subjects as possible. */
export function makeEpisode(previous: readonly string[] = [], random = Math.random): Episode {
  const excluded = new Set(previous);
  const fresh = SHOW_FACTS.filter(({ id }) => !excluded.has(id));
  const pool = fresh.length >= ROUND_NAMES.length ? fresh : [...SHOW_FACTS];
  const shortlisted: ScaleFact[] = [];
  while (shortlisted.length < ROUND_NAMES.length) {
    const distinct = pool.filter((fact) => shortlisted.every(({ category }) => category !== fact.category));
    const choices = distinct.length ? distinct : pool;
    const choice = choices[Math.floor(random() * choices.length)]!;
    shortlisted.push(choice);
    pool.splice(pool.indexOf(choice), 1);
  }
  const seed = Math.floor(random() * 36 ** 8).toString(36).padStart(8, "0");
  return decodeEpisode([seed, ...shortlisted.map(({ id }) => id)].join("."))!;
}

export function rangeBounds(guess: Rat, band: number) {
  const { factor } = RANGE_BANDS[band]!;
  return { low: div(guess, factor), high: mul(guess, factor) };
}

function rangePoints(guess: Rat, target: Rat, band: number) {
  const { low, high } = rangeBounds(guess, band);
  return cmp(target, low) >= 0 && cmp(target, high) <= 0 ? RANGE_BANDS[band]!.points : 0;
}

export function maxWager(score: Scoreboard) {
  return Math.min(LAST_WAGER, score.you, score.house);
}

export function scoreShowRound(round: ShowRound, pick: ShowPick, score: Scoreboard): ShowResult | null {
  if (round.kind !== pick.kind) return null;
  const target = factAmount(round.fact.value);
  let base: Scoreboard;
  let transfer = 0;
  if (round.kind === "direction" && pick.kind === "direction") {
    const actual = round.fact.value > round.benchmark ? "higher" : "lower";
    base = { you: pick.direction === actual ? 100 : 0, house: round.houseCall === actual ? 100 : 0 };
  } else if (round.kind === "window" && pick.kind === "window") {
    if (!RANGE_BANDS[pick.band] || pick.guess.n <= 0n) return null;
    base = {
      you: rangePoints(pick.guess, target, pick.band),
      house: rangePoints(factAmount(round.houseGuess), target, round.houseBand),
    };
  } else if ((round.kind === "estimate" || round.kind === "final") && (pick.kind === "estimate" || pick.kind === "final")) {
    if (pick.guess.n <= 0n) return null;
    const you = scoreValue(pick.guess, target);
    const house = scoreValue(factAmount(round.houseGuess), target);
    base = { you: you.points, house: house.points };
    if (pick.kind === "final") {
      if (!Number.isInteger(pick.wager) || pick.wager < 0 || pick.wager > maxWager(score)) return null;
      transfer = cmp(you.ratioClose, house.ratioClose) * pick.wager;
    }
  } else {
    return null;
  }
  return { base, change: { you: base.you + transfer, house: base.house - transfer }, transfer, pick };
}

export function accumulateScore(results: readonly ShowResult[]): Scoreboard {
  return results.reduce((total, { change }) => ({ you: total.you + change.you, house: total.house + change.house }), { you: 0, house: 0 });
}

export function readShowRecord(raw: string | null): ShowRecord {
  try {
    const saved = JSON.parse(raw ?? "null");
    if (saved && Object.keys(blankRecord).every((key) => Number.isSafeInteger(saved[key]) && saved[key] >= 0)
      && saved.streak <= saved.wins && saved.wins <= saved.played && saved.best <= 600) {
      return { played: saved.played, wins: saved.wins, streak: saved.streak, best: saved.best };
    }
  } catch {
    // Invalid or unavailable browser progress starts at zero.
  }
  return { ...blankRecord };
}

export function finishShow(record: ShowRecord, result: Scoreboard): ShowRecord {
  const win = result.you > result.house ? 1 : 0;
  return {
    played: record.played + 1,
    wins: record.wins + win,
    streak: win ? record.streak + 1 : 0,
    best: Math.max(result.you, record.best),
  };
}
