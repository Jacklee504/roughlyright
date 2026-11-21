import { CORE_SCALE_FACTS, type ScaleFact } from "./scale-facts";
import { EXTRA_SCALE_FACTS } from "./scale-facts-extra";

export const SCALE_FACTS = [...CORE_SCALE_FACTS, ...EXTRA_SCALE_FACTS];
export const SCALE_ROUNDS = 7;
export const SCALE_REVIEW_LIMIT = 3;
export const SCALE_MAX_SCORE = 1_000;
export const SCALE_PROGRESS_KEY = "rr_scale_run_v1";

const byId = new Map(SCALE_FACTS.map((fact) => [fact.id, fact]));
const optionsPerRound = 5;

export function nearestPower(value: number): number {
  return Math.round(Math.log10(value));
}

/** Keep choice positions identical in every copy of a shared course. */
export function rulerChoices(fact: ScaleFact): number[] {
  let hash = 0;
  for (const char of fact.id) hash = (Math.imul(hash, 31) + char.charCodeAt(0)) >>> 0;
  const start = nearestPower(fact.value) - (hash % optionsPerRound);
  return Array.from({ length: optionsPerRound }, (_, index) => start + index);
}

function shuffle<T>(values: T[], random: () => number): T[] {
  const result = [...values];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

/** A fresh course excludes the previous run and starts with a mix of subjects. */
export function makeScaleCourse(previous: string[] = [], random = Math.random): ScaleFact[] {
  const prior = new Set(previous);
  const shuffled = shuffle(SCALE_FACTS, random);
  const pool = shuffled.filter(({ id }) => !prior.has(id));
  if (pool.length < SCALE_ROUNDS) pool.push(...shuffled.filter(({ id }) => prior.has(id)));
  const categories = new Set<ScaleFact["category"]>();
  return Array.from({ length: SCALE_ROUNDS }, () => {
    const newCategory = pool.findIndex(({ category }) => !categories.has(category));
    const [fact] = pool.splice(Math.max(0, newCategory), 1);
    categories.add(fact.category);
    return fact;
  });
}

/** Mix past misses into a normal course, with a different card between reviews. */
export function makeCalibrationCourse(queue: string[], previous: string[], random = Math.random) {
  const review = [...new Set(queue)]
    .map((id) => byId.get(id))
    .filter((fact) => fact !== undefined)
    .slice(0, SCALE_REVIEW_LIMIT);
  const reviewIds = review.map(({ id }) => id);
  const course = makeScaleCourse([...previous, ...reviewIds], random).slice(0, SCALE_ROUNDS - review.length);
  review.forEach((fact, index) => course.splice(1 + index * 2, 0, fact));
  return { course, reviewIds };
}

export function encodeScaleCourse(course: ScaleFact[]): string {
  return course.map(({ id }) => id).join(".");
}

export function decodeScaleCourse(code: string | undefined): ScaleFact[] | null {
  if (!code || code.length > 400) return null;
  const ids = code.split(".");
  if (ids.length !== SCALE_ROUNDS || new Set(ids).size !== SCALE_ROUNDS) return null;
  const course = ids.map((id) => byId.get(id));
  return course.every((fact) => fact !== undefined) ? course : null;
}

export type ScaleOutcome = "hit" | "near" | "miss";
export type ScaleResult = {
  guess: number;
  outcome: ScaleOutcome;
  points: number;
  combo: number;
};

export function scaleBonus(combo: number): number {
  return Math.min(60, combo * 20);
}

export function scoreScaleGuess(value: number, guess: number, combo: number): ScaleResult {
  const distance = Math.abs(nearestPower(value) - guess);
  if (distance === 0) return { guess, outcome: "hit", points: 100 + scaleBonus(combo), combo: combo + 1 };
  if (distance === 1) return { guess, outcome: "near", points: 40, combo: 0 };
  return { guess, outcome: "miss", points: 0, combo: 0 };
}

/** An exact hit clears a card. Misses move to the back so older cards get a turn. */
export function updateScaleReviewQueue(queue: string[], course: ScaleFact[], results: ScaleResult[]): string[] {
  const played = new Set(course.map(({ id }) => id));
  const missed = course.filter((_, index) => results[index].outcome !== "hit").map(({ id }) => id);
  return [...queue.filter((id) => !played.has(id)), ...missed];
}
