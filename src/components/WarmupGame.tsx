"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type FormEvent } from "react";
import GuessGraph from "@/components/GuessGraph";
import PixelConfetti from "@/components/PixelConfetti";
import PixelSprite from "@/components/pixel/PixelSprite";
import { OWL, OWL_PALETTE } from "@/components/pixel/art";
import { direction, scoreValue } from "@/lib/domain/scoring";
import { ratToString } from "@/lib/domain/decimal";
import { formatDisplay, parseNumber } from "@/lib/domain/numberParser";
import { makeWarmup } from "@/lib/domain/warmup";
import { MARK_ICONS, markClass } from "@/lib/marks";
import type { Mark } from "@/lib/dto";

type WarmupResult = {
  points: number;
  mark: Mark;
  outcome: "scored" | "pass";
  guess?: string;
  direction?: "high" | "low";
  errorFactor?: string;
};

export default function WarmupGame() {
  const [rounds, setRounds] = useState<ReturnType<typeof makeWarmup>>([]);
  const [results, setResults] = useState<WarmupResult[]>([]);
  const [ordinal, setOrdinal] = useState(0);
  const [input, setInput] = useState("");
  const [error, setError] = useState("");
  const [best, setBest] = useState<number | null>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const next = useRef<HTMLButtonElement>(null);
  const round = rounds[ordinal];
  const result = results[ordinal];
  const total = results.reduce((sum, r) => sum + r.points, 0);
  const complete = rounds.length > 0 && ordinal === rounds.length;

  useEffect(() => {
    if (rounds.length) heading.current?.focus();
  }, [ordinal, rounds]);

  useEffect(() => {
    if (result) next.current?.focus({ preventScroll: true });
  }, [result]);

  function start() {
    setRounds(makeWarmup(rounds.map((question) => question.scenario)));
    setResults([]);
    setOrdinal(0);
    setInput("");
    setError("");
  }

  function submit(e: FormEvent) {
    e.preventDefault();
    if (!round || result) return;
    const mode = round.countMode ? "count" : "measured";
    const parsed = parseNumber(input, mode, round.unit);
    if (!parsed.ok) {
      setError(parsed.message);
      return;
    }
    const target = parseNumber(String(round.answer), mode, round.unit);
    if (!target.ok) return;
    const { points, mark, errorFactor } = scoreValue(parsed.value, target.value);
    setError("");
    setResults([...results, {
      outcome: "scored",
      points,
      mark,
      guess: formatDisplay(parsed.canonical),
      direction: direction(parsed.value, target.value),
      errorFactor: ratToString(errorFactor, 6),
    }]);
  }

  function advance() {
    if (ordinal === rounds.length - 1) setBest(best === null ? total : Math.max(best, total));
    setOrdinal(ordinal + 1);
    setInput("");
    setError("");
  }

  return (
    <main className="play-shell">
      <div className="game-heading">
        <div><p className="eyebrow">Unranked</p><h1>Warm-up</h1></div>
        <Link className="btn quiet" href="/estimation">Today’s puzzle</Link>
      </div>
      {complete ? (
        <section className="card warmup-end" aria-labelledby="warmup-result">
          {total >= 350 ? <PixelConfetti count={56} /> : null}
          <PixelSprite sprite={total >= 350 ? OWL.star : OWL.happy} palette={OWL_PALETTE} size={64} />
          <h2 id="warmup-result" ref={heading} tabIndex={-1}>{total}<span> / 500</span></h2>
          <p className="muted">{total === best ? "Session best" : `Session best · ${best}/500`}</p>
          <ul className="warmup-marks" aria-label="Round scores">
            {results.map((r, index) => <li key={index} className={markClass(r.mark)}>{r.points} <span className="sr-only">points, {r.mark}</span></li>)}
          </ul>
          <div className="actions recap-actions">
            <button className="primary" onClick={start}>Play another set <span aria-hidden="true">→</span></button>
            <Link className="btn" href="/estimation/scale-run">Try Scale Run</Link>
          </div>
        </section>
      ) : round ? (
        <>
          <div className="practice-progress">
            <span>Round {ordinal + 1} of {rounds.length}</span>
            <progress aria-label="Rounds scored" max={rounds.length} value={results.length} />
            <span>{total} / 500</span>
          </div>
          <section className="card question-card" key={ordinal} aria-labelledby="warmup-question">
            <h2 className="prompt-text" id="warmup-question" ref={heading} tabIndex={-1}>{round.prompt}</h2>
            {result ? (
              <>
                <div className="round-answer" aria-live="polite">
                  <div><span className="eyebrow">Answer</span><strong>{formatDisplay(String(round.answer))} {round.unit}</strong></div>
                  <span className={markClass(result.mark)}>{MARK_ICONS[result.mark]} {result.points} pts</span>
                </div>
                {result.guess ? (
                  <p className="muted">You guessed {result.guess} {round.unit}{result.mark === "Exact" ? "." : ` · too ${result.direction}.`}</p>
                ) : null}
                <GuessGraph resolved={result} />
                <p>{round.work}</p>
                <button className="primary" ref={next} onClick={advance}>
                  {ordinal === rounds.length - 1 ? "See results" : "Next question"} <span aria-hidden="true">→</span>
                </button>
              </>
            ) : (
              <form onSubmit={submit}>
                <label htmlFor="warmup-input">Your estimate ({round.unit})</label>
                <div className="input-row">
                  <input
                    id="warmup-input"
                    type="text"
                    inputMode="decimal"
                    autoComplete="off"
                    enterKeyHint="go"
                    maxLength={200}
                    value={input}
                    onChange={(e) => { setInput(e.target.value); setError(""); }}
                    aria-describedby="warmup-format"
                    aria-invalid={error ? true : undefined}
                  />
                  <span className="unit-tag" aria-hidden="true">{round.unit}</span>
                </div>
                <p className={`small ${error ? "input-error" : "muted"}`} id="warmup-format">{error || "Enter a number, such as 5,000 or 5000."}</p>
                {error ? <span role="alert" className="sr-only">{error}</span> : null}
                <details className="hint"><summary>Show hint</summary><p>{round.hint}</p></details>
                <div className="actions">
                  <button type="submit" className="primary" disabled={!input.trim()}>Lock guess</button>
                  <button type="button" onClick={() => setResults([...results, { outcome: "pass", mark: "Pass", points: 0 }])}>Pass</button>
                </div>
              </form>
            )}
          </section>
        </>
      ) : (
        <section className="card warmup-intro">
          <PixelSprite sprite={OWL.think} palette={OWL_PALETTE} size={80} />
          <div>
            <h2>Find your ballpark.</h2>
            <p>Five quick estimates with a worked answer after each guess. Try for 500, then see if you can top it with a fresh set.</p>
            <button className="primary" onClick={start}>Start warm-up <span aria-hidden="true">→</span></button>
          </div>
        </section>
      )}
    </main>
  );
}
