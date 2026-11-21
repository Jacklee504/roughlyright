import { describe, expect, it } from "vitest";
import {
  SCALE_FACTS,
  SCALE_MAX_SCORE,
  SCALE_ROUNDS,
  decodeScaleCourse,
  encodeScaleCourse,
  makeCalibrationCourse,
  makeScaleCourse,
  nearestPower,
  rulerChoices,
  scoreScaleGuess,
  updateScaleReviewQueue,
} from "@/lib/domain/scale-run";

describe("Scale Run", () => {
  it("rounds by the closest factor across positive and negative powers", () => {
    expect(nearestPower(1_500)).toBe(3);
    expect(nearestPower(500)).toBe(3);
    expect(nearestPower(250)).toBe(2);
    expect(nearestPower(0.00007)).toBe(-4);
  });

  it("offers five ordered choices and varies the correct position", () => {
    const correctPositions = new Set<number>();
    for (const fact of SCALE_FACTS) {
      const options = rulerChoices(fact);
      const correct = nearestPower(fact.value);
      expect(Number.isFinite(fact.value) && fact.value > 0).toBe(true);
      expect(fact.source.url).toMatch(/^https:\/\//);
      expect(options).toHaveLength(5);
      expect(options.slice(1).every((option, index) => option - options[index] === 1)).toBe(true);
      expect(options).toContain(correct);
      correctPositions.add(options.indexOf(correct));
    }
    expect(correctPositions.size).toBe(5);
    expect(new Set(SCALE_FACTS.map(({ id }) => id)).size).toBe(SCALE_FACTS.length);
  });

  it("skips all seven cards from the preceding course and starts with varied subjects", () => {
    const course = makeScaleCourse([], () => 0.42);
    const previous = course.map(({ id }) => id);
    const replay = makeScaleCourse(previous, () => 0.42);
    expect(replay).toHaveLength(SCALE_ROUNDS);
    expect(new Set(replay.map(({ id }) => id)).size).toBe(SCALE_ROUNDS);
    expect(replay.every(({ id }) => !previous.includes(id))).toBe(true);
    expect(new Set(course.slice(0, 5).map(({ category }) => category)).size).toBe(5);
  });

  it("round-trips shared course order and presented choices and rejects invalid links", () => {
    const course = makeScaleCourse([], () => 0.73);
    const shared = decodeScaleCourse(encodeScaleCourse(course));
    expect(shared?.map(({ id }) => id)).toEqual(course.map(({ id }) => id));
    expect(shared?.map(rulerChoices)).toEqual(course.map(rulerChoices));
    expect(decodeScaleCourse("bad.link")).toBeNull();
    expect(decodeScaleCourse(Array(SCALE_ROUNDS).fill(course[0].id).join("."))).toBeNull();
    expect(decodeScaleCourse(encodeScaleCourse(course).replace(course[0].id, "missing"))).toBeNull();
    expect(decodeScaleCourse("x".repeat(401))).toBeNull();
  });

  it("spaces up to three missed cards between different questions and shares the exact course", () => {
    const previous = makeScaleCourse([], () => 0.42).map(({ id }) => id);
    const queue = ["invalid", previous[0], previous[0], previous[1], previous[2], previous[3]];
    const { course, reviewIds } = makeCalibrationCourse(queue, previous, () => 0.42);

    expect(reviewIds).toEqual(previous.slice(0, 3));
    expect(course).toHaveLength(SCALE_ROUNDS);
    expect(new Set(course.map(({ id }) => id)).size).toBe(SCALE_ROUNDS);
    expect([course[1].id, course[3].id, course[5].id]).toEqual(reviewIds);
    expect([0, 2, 4, 6].every((index) => !previous.includes(course[index].id))).toBe(true);
    expect(decodeScaleCourse(encodeScaleCourse(course))).toEqual(course);

    const oneReview = makeCalibrationCourse(previous.slice(0, 1), previous, () => 0.42);
    expect(oneReview.course).toHaveLength(SCALE_ROUNDS);
    expect(oneReview.course[1].id).toBe(previous[0]);
    expect(oneReview.course.filter(({ id }) => previous.includes(id))).toHaveLength(1);
  });

  it("clears exact hits from the queue and keeps missed cards behind any waiting review", () => {
    const [waiting, recovered, missedAgain, newMiss] = SCALE_FACTS;
    const course = [recovered, missedAgain, newMiss];
    const results = [
      scoreScaleGuess(recovered.value, nearestPower(recovered.value), 0),
      scoreScaleGuess(missedAgain.value, nearestPower(missedAgain.value) - 1, 1),
      scoreScaleGuess(newMiss.value, nearestPower(newMiss.value) + 2, 0),
    ];
    const originalQueue = [recovered.id, missedAgain.id, waiting.id];

    expect(updateScaleReviewQueue(originalQueue, course, results)).toEqual([waiting.id, missedAgain.id, newMiss.id]);
    expect(originalQueue).toEqual([recovered.id, missedAgain.id, waiting.id]);
  });

  it("caps a seven-hit combo at 1,000 points and resets combos on a miss or adjacent answer", () => {
    let combo = 0;
    let total = 0;
    for (let round = 0; round < SCALE_ROUNDS; round++) {
      const result = scoreScaleGuess(499, 3, combo);
      combo = result.combo;
      total += result.points;
    }
    expect(combo).toBe(SCALE_ROUNDS);
    expect(total).toBe(SCALE_MAX_SCORE);
    expect(scoreScaleGuess(499, 2, 5)).toEqual({ guess: 2, outcome: "near", points: 40, combo: 0 });
    expect(scoreScaleGuess(499, 1, 5)).toEqual({ guess: 1, outcome: "miss", points: 0, combo: 0 });
  });
});
