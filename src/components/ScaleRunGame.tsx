"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import PixelConfetti from "@/components/PixelConfetti";
import PixelSprite from "@/components/pixel/PixelSprite";
import { SIGNAL_METER, SIGNAL_PALETTE } from "@/components/pixel/art";
import type { ScaleFact } from "@/lib/domain/scale-facts";
import {
  SCALE_FACTS,
  SCALE_MAX_SCORE,
  SCALE_PROGRESS_KEY,
  SCALE_REVIEW_LIMIT,
  SCALE_ROUNDS,
  encodeScaleCourse,
  makeCalibrationCourse,
  makeScaleCourse,
  nearestPower,
  rulerChoices,
  scaleBonus,
  scoreScaleGuess,
  updateScaleReviewQueue,
  type ScaleOutcome,
  type ScaleResult,
} from "@/lib/domain/scale-run";
import styles from "./ScaleRunGame.module.css";

type Progress = { best: number; mastered: string[]; lastCourse: string[]; reviewQueue: string[] };

const blankProgress: Progress = { best: 0, mastered: [], lastCourse: [], reviewQueue: [] };
const knownFacts = new Set(SCALE_FACTS.map(({ id }) => id));
const outcomeLabel: Record<ScaleOutcome, string> = {
  hit: "Right scale",
  near: "One step away",
  miss: "Off scale",
};
const outcomeMark: Record<ScaleOutcome, string> = { hit: "◆", near: "◐", miss: "○" };
const shareMark: Record<ScaleOutcome, string> = { hit: "🟩", near: "🟨", miss: "⬛" };
const number = new Intl.NumberFormat("en-US", { maximumSignificantDigits: 8 });
const compact = new Intl.NumberFormat("en-US", { notation: "compact" });

function savedIds(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.filter((id): id is string => typeof id === "string" && knownFacts.has(id)))];
}

function readProgress(): Progress {
  try {
    const raw = window.localStorage.getItem(SCALE_PROGRESS_KEY);
    if (raw) {
      const saved = JSON.parse(raw);
      return {
        best: Number.isInteger(saved.best) && saved.best >= 0 && saved.best <= SCALE_MAX_SCORE ? saved.best : 0,
        mastered: savedIds(saved.mastered),
        lastCourse: savedIds(saved.lastCourse),
        reviewQueue: savedIds(saved.reviewQueue),
      };
    }
  } catch {
    // The current run still works when storage is disabled or corrupt.
  }
  return blankProgress;
}

function Magnitude({ exponent }: { exponent: number }) {
  if (exponent < -2 || exponent > 14) return <>10<sup>{exponent < 0 ? `−${Math.abs(exponent)}` : exponent}</sup></>;
  return compact.format(10 ** exponent);
}

function workedAnswer(fact: ScaleFact) {
  return `${number.format(fact.value)} ${fact.unit}`;
}

function CalibrationPrompt({ pending, onStart }: { pending: number; onStart: () => void }) {
  if (!pending) return null;
  const reviewCount = Math.min(pending, SCALE_REVIEW_LIMIT);
  return (
    <section className={`card ${styles.calibration}`} aria-labelledby="scale-calibration">
      <div>
        <h2 id="scale-calibration">Calibrate your guesses</h2>
        <p className="muted">Revisit {reviewCount} missed {reviewCount === 1 ? "scale" : "scales"} alongside {SCALE_ROUNDS - reviewCount} other questions.</p>
      </div>
      <button className="primary" onClick={onStart}>Start calibration run <span aria-hidden="true">→</span></button>
    </section>
  );
}

function GuessBreakdown({ course, results, reviewIds }: {
  course: ScaleFact[];
  results: ScaleResult[];
  reviewIds: string[];
}) {
  const counts = { low: 0, right: 0, high: 0, recovered: 0 };
  course.forEach((fact, index) => {
    const offset = results[index].guess - nearestPower(fact.value);
    counts[offset < 0 ? "low" : offset > 0 ? "high" : "right"]++;
    if (offset === 0 && reviewIds.includes(fact.id)) counts.recovered++;
  });

  return (
    <section className={`card ${styles.breakdown}`} aria-labelledby="scale-breakdown">
      <h2 id="scale-breakdown">How you estimated</h2>
      {reviewIds.length ? <p className={styles.recovered}><strong>{counts.recovered} of {reviewIds.length}</strong> review scales recovered</p> : null}
      <ul aria-label="Guesses across the seven rounds">
        <li><span aria-hidden="true">↓</span> <strong>{counts.low}</strong> too low</li>
        <li><span aria-hidden="true">◆</span> <strong>{counts.right}</strong> on target</li>
        <li><span aria-hidden="true">↑</span> <strong>{counts.high}</strong> too high</li>
      </ul>
    </section>
  );
}

export default function ScaleRunGame({ challenge, invalidChallenge }: {
  challenge: ScaleFact[] | null;
  invalidChallenge: boolean;
}) {
  const [course, setCourse] = useState<ScaleFact[]>([]);
  const [reviewIds, setReviewIds] = useState<string[]>([]);
  const [results, setResults] = useState<ScaleResult[]>([]);
  const [index, setIndex] = useState(0);
  const [progress, setProgress] = useState<Progress>(blankProgress);
  const [personalBest, setPersonalBest] = useState(false);
  const [copy, setCopy] = useState<{ state: "copied" | "manual"; text: string; url: string } | null>(null);
  const questionRef = useRef<HTMLHeadingElement>(null);
  const answerRef = useRef<HTMLHeadingElement>(null);
  const shareRef = useRef<HTMLTextAreaElement>(null);
  const progressInMemory = useRef(false);
  const fact = course[index];
  const result = results[index];
  const reviewRound = fact && reviewIds.includes(fact.id);
  const total = results.reduce((sum, item) => sum + item.points, 0);
  const complete = course.length > 0 && index === course.length;
  const priorCombo = results[index - 1]?.combo ?? 0;
  const currentCombo = result?.combo ?? priorCombo;
  const bestCombo = Math.max(0, ...results.map((item) => item.combo));
  const hits = results.filter((item) => item.outcome === "hit").length;
  const choices = fact ? rulerChoices(fact) : [];

  useEffect(() => { setProgress(readProgress()); }, []);

  useEffect(() => {
    if (course.length) questionRef.current?.focus();
  }, [course, index]);

  useEffect(() => {
    answerRef.current?.focus();
  }, [result]);

  useEffect(() => {
    if (copy?.state === "manual") {
      shareRef.current?.focus();
      shareRef.current?.select();
    }
  }, [copy]);

  function start({ shared, calibrate = false }: { shared?: ScaleFact[]; calibrate?: boolean } = {}) {
    const saved = progressInMemory.current ? progress : readProgress();
    const previous = course.length ? course.map(({ id }) => id) : saved.lastCourse;
    const next = calibrate
      ? makeCalibrationCourse(saved.reviewQueue, previous)
      : { course: shared ?? makeScaleCourse(previous), reviewIds: [] };
    setCourse(next.course);
    setReviewIds(next.reviewIds);
    setResults([]);
    setIndex(0);
    setPersonalBest(false);
    setCopy(null);
  }

  function select(exponent: number) {
    if (!fact || result || !choices.includes(exponent)) return;
    setResults((previous) => previous.length === index
      ? [...previous, scoreScaleGuess(fact.value, exponent, priorCombo)]
      : previous);
  }

  function handleKeyboard(event: KeyboardEvent<HTMLElement>) {
    if (!fact || event.repeat || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
    if (result) {
      if (event.key === "Enter" && event.target === answerRef.current) {
        event.preventDefault();
        advance();
      }
      return;
    }
    if (/^[1-5]$/.test(event.key)) {
      event.preventDefault();
      select(choices[Number(event.key) - 1]);
    }
  }

  function advance() {
    if (!result) return;
    if (index === course.length - 1) {
      const saved = progressInMemory.current ? progress : readProgress();
      const newMastery = course.filter((_, i) => results[i].outcome === "hit").map(({ id }) => id);
      const updated = {
        best: Math.max(total, saved.best, progress.best),
        mastered: [...new Set([...saved.mastered, ...progress.mastered, ...newMastery])],
        lastCourse: course.map(({ id }) => id),
        reviewQueue: updateScaleReviewQueue(saved.reviewQueue, course, results),
      };
      setPersonalBest(total > Math.max(saved.best, progress.best));
      setProgress(updated);
      try {
        window.localStorage.setItem(SCALE_PROGRESS_KEY, JSON.stringify(updated));
        progressInMemory.current = false;
      } catch {
        progressInMemory.current = true;
      }
    }
    setIndex((round) => Math.min(round + 1, course.length));
  }

  async function copyChallenge() {
    const url = new URL("/estimation/scale-run", window.location.origin);
    url.searchParams.set("course", encodeScaleCourse(course));
    const marks = results.map(({ outcome }) => shareMark[outcome]).join("");
    const text = `Roughly Right · Scale Run\n${total}/${SCALE_MAX_SCORE} ${marks}\nPlay my seven questions: ${url}`;
    try {
      await navigator.clipboard.writeText(text);
      setCopy({ state: "copied", text, url: url.toString() });
    } catch {
      setCopy({ state: "manual", text, url: url.toString() });
    }
  }

  return (
    <main className={`play-shell ${styles.shell}`} onKeyDown={handleKeyboard}>
      <div className="game-heading">
        <h1>Scale Run</h1>
        <Link className="btn quiet" href="/estimation">Today’s puzzle</Link>
      </div>
      {complete ? (
        <>
          <section className={`card ${styles.finish}`} aria-labelledby="scale-finish">
            {total === SCALE_MAX_SCORE ? <PixelConfetti count={52} duration={1.5} /> : null}
            <p className="eyebrow">{total === SCALE_MAX_SCORE ? "Perfect run" : personalBest ? "New personal best" : "Run complete"}</p>
            <h2 id="scale-finish" className={styles.finishScore} tabIndex={-1} ref={questionRef}>
              {number.format(total)} <span>/ {number.format(SCALE_MAX_SCORE)}</span>
            </h2>
            <p className="muted">{hits} of {SCALE_ROUNDS} on the right scale · {bestCombo} best combo</p>
            <ol className={styles.finishMarks} aria-label="Round scores">
              {results.map(({ outcome, points }, i) => (
                <li className={styles[outcome]} key={course[i].id}>
                  <span aria-hidden="true">{outcomeMark[outcome]}</span>
                  <small>{points}</small>
                  <span className="sr-only"> points. {outcomeLabel[outcome]}.</span>
                </li>
              ))}
            </ol>
            <div className={`actions ${styles.finishActions}`}>
              <button className={progress.reviewQueue.length ? undefined : "primary"} onClick={() => start()}>Play a fresh run</button>
              <button onClick={copyChallenge}>Copy a challenge</button>
            </div>
            {copy?.state === "copied" ? <p className="muted" role="status">Challenge copied. Anyone with the link gets these seven questions.</p> : null}
            {copy?.state === "manual" ? (
              <textarea className={styles.share} ref={shareRef} rows={3} value={copy.text} readOnly aria-label="Score and challenge link" onFocus={(event) => event.currentTarget.select()} />
            ) : null}
            {copy ? <p><a href={copy.url}>Open this challenge</a></p> : null}
          </section>
          <section className={styles.mastery} aria-label="Scale Run progress">
            <span><strong>{progress.mastered.length}/{SCALE_FACTS.length}</strong> scales mastered</span>
            <span>Personal best <strong>{number.format(progress.best)}</strong></span>
          </section>
          <CalibrationPrompt pending={progress.reviewQueue.length} onStart={() => start({ calibrate: true })} />
          <GuessBreakdown course={course} results={results} reviewIds={reviewIds} />
          <details className={`card ${styles.review}`}>
            <summary>Review all seven answers</summary>
            <ol>
              {course.map((item, i) => (
                <li key={item.id}>
                  <h3>{item.prompt}</h3>
                  <p className="muted">Your pick <Magnitude exponent={results[i].guess} /> {item.unit} · Answer <strong>{workedAnswer(item)}</strong></p>
                  <p>{item.note}</p>
                  <a href={item.source.url}>{item.source.label}</a>
                </li>
              ))}
            </ol>
          </details>
        </>
      ) : fact ? (
        <>
          <div className={styles.hud}>
            <span>Round {index + 1}/{SCALE_ROUNDS}</span>
            <ol className={styles.lamps} aria-label="Run progress">
              {course.map((step, i) => (
                <li
                  aria-label={results[i] ? outcomeLabel[results[i].outcome] : i === index ? "Current round" : "Upcoming round"}
                  className={results[i] ? styles[results[i].outcome] : i === index ? styles.current : undefined}
                  key={step.id}
                />
              ))}
            </ol>
            <strong>{number.format(total)} pts</strong>
          </div>
          <section className={`card ${styles.instrument}`} aria-labelledby="scale-question">
            <div className={styles.instrumentHead}>
              <p className="eyebrow">{fact.category}{reviewRound ? " · Review" : ""}</p>
              {currentCombo > 0 ? <p className={styles.combo}><span aria-hidden="true">⚡</span> {currentCombo} in a row</p> : null}
            </div>
            <h2 className="prompt-text" id="scale-question" tabIndex={-1} ref={questionRef}>{fact.prompt}</h2>
            <p className={styles.rulerLabel}>
              {result ? <>Closest choice in <strong>{fact.unit}</strong></> : <>Pick the closest scale in <strong>{fact.unit}</strong></>}
            </p>
            <div className={styles.ruler} role="group" aria-label={`Choices in ${fact.unit}`}>
              {choices.map((exponent, i) => {
                const correct = Boolean(result) && exponent === nearestPower(fact.value);
                const selected = result?.guess === exponent;
                return (
                  <button
                    type="button"
                    key={exponent}
                    disabled={Boolean(result)}
                    aria-label={`${number.format(10 ** exponent)} ${fact.unit}${selected ? ", your pick" : ""}${correct ? ", closest choice" : ""}`}
                    aria-keyshortcuts={String(i + 1)}
                    className={`${styles.choice}${correct ? ` ${styles.correct}` : ""}${selected ? ` ${styles.selected}` : ""}`}
                    onClick={() => select(exponent)}
                  >
                    <span className={styles.tick} aria-hidden="true" />
                    <strong><Magnitude exponent={exponent} /></strong>
                    <small aria-hidden="true">{correct ? "Closest" : selected ? "Your pick" : result ? "\u00a0" : i + 1}</small>
                  </button>
                );
              })}
            </div>
            {result ? (
              <div className={styles.answer}>
                <div className={styles.reading}>
                  <div>
                    <p className={`eyebrow ${styles[result.outcome]}`}>
                      {reviewRound && result.outcome === "hit" ? "Scale recovered" : outcomeLabel[result.outcome]}
                    </p>
                    <h3 tabIndex={-1} ref={answerRef}>{workedAnswer(fact)}</h3>
                  </div>
                  <strong>+{result.points}{result.points > 100 ? <small>{result.points - 100} combo bonus</small> : null}</strong>
                </div>
                <p>{fact.note}</p>
                <div className={styles.answerActions}>
                  <a href={fact.source.url}>Source · {fact.source.label}</a>
                  <button className="primary" aria-keyshortcuts="Enter" onClick={advance}>{index + 1 === SCALE_ROUNDS ? "See results" : "Next question"} <span aria-hidden="true">→</span></button>
                </div>
              </div>
            ) : (
              <p className={`muted small ${styles.nextBonus}`}>{priorCombo > 0 ? `${100 + scaleBonus(priorCombo)} points for the right scale` : "Each step on the ruler is 10× the previous one."}</p>
            )}
          </section>
        </>
      ) : (
        <>
          <section className={`card ${styles.cover}`} aria-labelledby="scale-cover">
            <div>
              <p className="eyebrow">{challenge ? "Shared challenge" : "Seven questions · no timer"}</p>
              <h2 id="scale-cover">How big is big?</h2>
              <p className="muted">From a hummingbird’s wings to the Sun. Place each answer on a ruler that jumps tenfold with every step.</p>
              {invalidChallenge ? <p role="status">This challenge link is unavailable. A fresh run is ready.</p> : null}
              <button className="primary" onClick={() => start({ shared: challenge ?? undefined })}>
                {challenge ? "Play this challenge" : "Start run"} <span aria-hidden="true">→</span>
              </button>
            </div>
            <div className={styles.coverArt} aria-hidden="true">
              <PixelSprite sprite={SIGNAL_METER} palette={SIGNAL_PALETTE} size={104} />
            </div>
          </section>
          {!challenge ? <CalibrationPrompt pending={progress.reviewQueue.length} onStart={() => start({ calibrate: true })} /> : null}
          <details className={`card ${styles.rules}`}>
            <summary>How scoring works</summary>
            <p>Pick the choice with the smallest factor between it and the answer. For 500, pick 1,000 (2× away) over 100 (5× away).</p>
            <p>The right scale earns 100 points. Consecutive hits add 20 points each up to a 60-point bonus. One step away earns 40. A larger miss earns zero. Both reset your combo.</p>
          </details>
          {progress.best > 0 ? (
            <div className={styles.mastery} aria-label="Saved Scale Run progress">
              <span><strong>{progress.mastered.length}/{SCALE_FACTS.length}</strong> scales mastered</span>
              <span>Personal best <strong>{number.format(progress.best)}</strong></span>
            </div>
          ) : null}
        </>
      )}
    </main>
  );
}
