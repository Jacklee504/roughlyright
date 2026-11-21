"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type FormEvent } from "react";
import PixelSprite from "@/components/pixel/PixelSprite";
import { CALC, CALC_PALETTE } from "@/components/pixel/art";
import { cmp, rat, type Rat } from "@/lib/domain/decimal";
import { LAB_CASES, LAB_MAX_SCORE, LAB_PROGRESS_KEY, evaluateLabCase, projectLabCase, readLabBests, type LabCase } from "@/lib/domain/estimation-lab";
import { MAX_RAW_LENGTH, parseNumber } from "@/lib/domain/numberParser";
import styles from "./EstimationLab.module.css";

const labPath = "/estimation/lab";
const decimal = new Intl.NumberFormat("en-US", { maximumSignificantDigits: 6 });
const scientific = new Intl.NumberFormat("en-US", { notation: "scientific", maximumSignificantDigits: 4 });
const smallError = rat(101n, 100n);

function readBests() {
  try {
    return readLabBests(window.localStorage.getItem(LAB_PROGRESS_KEY));
  } catch {
    return {};
  }
}

function format(value: Rat | number) {
  const amount = typeof value === "number" ? value : Number(value.n) / Number(value.d);
  return (amount < 0.0001 || amount >= 1e15 ? scientific : decimal).format(amount);
}

function caseLink(labCase: LabCase) {
  return `${labPath}?case=${labCase.id}`;
}

function LabBoard({ bests }: { bests: Record<string, number> }) {
  const solved = Object.keys(bests).length;
  return (
    <>
      <section className={`card ${styles.cover}`} aria-labelledby="lab-cover">
        <div>
          <h2 id="lab-cover">Big questions. Small guesses.</h2>
          <p>Build an estimate one piece at a time, then test what happens when you change a single assumption.</p>
        </div>
        <PixelSprite sprite={CALC} palette={CALC_PALETTE} size={76} />
      </section>
      <section aria-labelledby="case-board">
        <div className={styles.boardHeading}>
          <h2 id="case-board">Case board</h2>
          <span>{solved} of {LAB_CASES.length} completed</span>
        </div>
        <ul className={styles.cases}>
          {LAB_CASES.map((labCase) => (
            <li key={labCase.id}>
              <Link href={caseLink(labCase)} className={styles.caseLink}>
                <span>
                  <strong>{labCase.title}</strong>
                  <small>{labCase.category}</small>
                </span>
                <span className={styles.caseStatus}>{bests[labCase.id] !== undefined ? `Best ${bests[labCase.id]}/${LAB_MAX_SCORE}` : "Open case"} <span aria-hidden="true">→</span></span>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}

function AssumptionRail({ labCase, guesses, active, onEdit }: {
  labCase: LabCase;
  guesses: Rat[];
  active: number;
  onEdit: (index: number) => void;
}) {
  return (
    <ol className={styles.rail} aria-label="Model assumptions">
      {labCase.factors.map(({ label, unit }, index) => {
        const guess = guesses[index];
        return (
          <li key={label} aria-current={index === active ? "step" : undefined}>
            {guess ? (
              <button type="button" onClick={() => onEdit(index)} aria-label={`Edit ${label}, currently ${format(guess)} ${unit}`}>
                <span>{label}</span><strong>{format(guess)} {unit}</strong>
              </button>
            ) : (
              <div><span>{label}</span><strong aria-label="Unestimated">?</strong></div>
            )}
          </li>
        );
      })}
    </ol>
  );
}

function LabReport({ labCase, guesses, bests, points, onRetry }: {
  labCase: LabCase;
  guesses: Rat[];
  bests: Record<string, number>;
  points: number;
  onRetry: () => void;
}) {
  const [usingReference, setUsingReference] = useState<number[]>([]);
  const heading = useRef<HTMLHeadingElement>(null);
  const result = evaluateLabCase(labCase, guesses);
  const next = LAB_CASES.find((candidate) => candidate.id !== labCase.id && bests[candidate.id] === undefined);
  const inputs = guesses.map((guess, index) => usingReference.includes(index) ? result.references[index]! : guess);
  const simulation = projectLabCase(labCase, inputs);

  useEffect(() => { heading.current?.focus(); }, []);

  function switchFactor(index: number) {
    setUsingReference((previous) => previous.includes(index) ? previous.filter((item) => item !== index) : [...previous, index]);
  }

  return (
    <>
      <section className={`card ${styles.result}`} aria-labelledby="lab-result">
        <p className="eyebrow">{labCase.title}</p>
        <h2 id="lab-result" ref={heading} tabIndex={-1}>Model complete</h2>
        <p className={styles.score}><strong>{points}</strong> / {LAB_MAX_SCORE} points</p>
        <dl className={styles.totals}>
          <div><dt>Your estimate</dt><dd>{format(result.projected)} {labCase.unit}</dd></div>
          <div><dt>Reference model</dt><dd>{format(result.model)} {labCase.unit}</dd></div>
        </dl>
        <p>{result.weakest === null ? "Every assumption matched the reference." : <>Start with <strong>{labCase.factors[result.weakest]!.label}</strong>. It was the furthest off.</>}</p>
        {result.opposingErrors ? <p className="muted">Some guesses pushed the total up while others pushed it down, so their errors partly cancelled out.</p> : null}
      </section>

      <section className={`card ${styles.inspect}`} aria-labelledby="lab-inspect">
        <h2 id="lab-inspect">Test your assumptions</h2>
        <p className="muted">Swap in a reference value to see how it changes the estimate.</p>
        <output className={styles.simulation} aria-live="polite">
          <span>What-if estimate</span><strong>{format(simulation)} {labCase.unit}</strong>
        </output>
        <ul className={styles.factors}>
          {labCase.factors.map(({ label, unit }, index) => {
            const reference = result.references[index]!;
            const guess = guesses[index]!;
            const comparison = cmp(guess, reference);
            const errorFactor = result.factors[index]!.errorFactor;
            const magnitude = cmp(errorFactor, smallError) < 0 ? "Slightly" : `${format(errorFactor)}×`;
            const direction = comparison > 0 ? "high" : "low";
            const selected = usingReference.includes(index);
            return (
              <li key={label}>
                <div>
                  <strong>{label}</strong>
                  <span>You {format(guess)} {unit} · Model {format(reference)} {unit}</span>
                  <small>{comparison ? `${magnitude} too ${direction}` : "Matched the model"}</small>
                </div>
                {comparison ? (
                  <button type="button" aria-label={`Use reference for ${label}`} aria-pressed={selected} onClick={() => switchFactor(index)}>
                    {selected ? "Using reference" : "Use reference"}
                  </button>
                ) : null}
              </li>
            );
          })}
        </ul>
        <details className={styles.source}>
          <summary>How the model works</summary>
          <p>{labCase.formula}</p>
          <p>{labCase.context}</p>
          <p className="muted">You can earn 100 points per assumption and 200 for the combined estimate. Being twice or half the reference earns half the possible points.</p>
          <ul>{labCase.sources.map((source) => <li key={source.url}><a href={source.url}>{source.name}</a></li>)}</ul>
        </details>
      </section>
      <div className="actions">
        {next ? <Link className="btn primary" href={caseLink(next)}>Next case <span aria-hidden="true">→</span></Link> : <Link className="btn primary" href={labPath}>View case board</Link>}
        <button type="button" onClick={onRetry}>Redo this case</button>
      </div>
    </>
  );
}

function LabRun({ labCase, bests, onScore }: {
  labCase: LabCase;
  bests: Record<string, number>;
  onScore: (score: number) => void;
}) {
  const [guesses, setGuesses] = useState<Rat[]>([]);
  const [editing, setEditing] = useState<number | null>(null);
  const [input, setInput] = useState("");
  const [error, setError] = useState("");
  const [points, setPoints] = useState<number | null>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const started = useRef(false);
  const active = editing ?? guesses.length;
  const factor = labCase.factors[active];

  useEffect(() => {
    if (started.current) heading.current?.focus();
  }, [active, points]);

  function edit(index: number) {
    started.current = true;
    setInput("");
    setError("");
    setEditing(index);
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    if (!factor) return;
    const parsed = parseNumber(input, "measured", factor.unit);
    if (!parsed.ok) {
      setError(parsed.message);
      return;
    }
    started.current = true;
    setGuesses((previous) => {
      const next = [...previous];
      next[active] = parsed.value;
      return next;
    });
    setInput("");
    setError("");
    setEditing(null);
  }

  function reveal() {
    const { points: score } = evaluateLabCase(labCase, guesses);
    setPoints(score);
    onScore(score);
  }

  function reset() {
    setGuesses([]);
    setPoints(null);
  }

  if (points !== null) return <LabReport labCase={labCase} guesses={guesses} bests={bests} points={points} onRetry={reset} />;

  return (
    <>
      <section className={`card ${styles.brief}`} aria-labelledby="case-title">
        <p className="eyebrow">{labCase.category}</p>
        <h2 id="case-title">{labCase.title}</h2>
        <p>{labCase.question}</p>
        <AssumptionRail labCase={labCase} guesses={guesses} active={active} onEdit={edit} />
      </section>
      {factor ? (
        <section key={active} className="card question-card" aria-labelledby="lab-question">
          <p className="eyebrow">Estimate {active + 1} of {labCase.factors.length}</p>
          <h2 id="lab-question" className="prompt-text" ref={heading} tabIndex={-1}>{factor.question}</h2>
          <form onSubmit={submit}>
            <label htmlFor="lab-guess">Your estimate ({factor.unit})</label>
            <div className="input-row">
              <input id="lab-guess" type="text" inputMode="decimal" enterKeyHint="next" autoComplete="off" maxLength={MAX_RAW_LENGTH} value={input}
                onChange={(event) => { setInput(event.target.value); setError(""); }} aria-invalid={error ? true : undefined} aria-describedby="lab-format" />
              <span className="unit-tag" aria-hidden="true">{factor.unit}</span>
            </div>
            <p id="lab-format" className={error ? "small input-error" : "small muted"} role={error ? "alert" : undefined}>{error || "Numbers only. You can use 1.2k for 1,200."}</p>
            <details className="hint"><summary>Show clue</summary><p>{factor.clue}</p></details>
            <div className="actions">
              <button className="primary" type="submit" disabled={!input.trim()}>{editing !== null ? "Update estimate" : active === labCase.factors.length - 1 ? "Build model" : "Lock estimate"} <span aria-hidden="true">→</span></button>
              {editing !== null ? <button type="button" onClick={() => { setEditing(null); setInput(""); setError(""); }}>Cancel</button> : null}
            </div>
          </form>
        </section>
      ) : (
        <section className={`card ${styles.result}`} aria-labelledby="lab-preview">
          <h2 id="lab-preview" ref={heading} tabIndex={-1}>Your model predicts</h2>
          <p className={styles.prediction}>{format(projectLabCase(labCase, guesses))} <span>{labCase.unit}</span></p>
          <p className="muted">{labCase.formula}</p>
          <button className="primary" type="button" onClick={reveal}>Check your model <span aria-hidden="true">→</span></button>
        </section>
      )}
    </>
  );
}

export default function EstimationLab({ labCase }: { labCase?: LabCase }) {
  const [bests, setBests] = useState<Record<string, number>>({});
  useEffect(() => { setBests(readBests()); }, []);

  function saveBest(score: number) {
    if (!labCase) return;
    const saved = readBests();
    const next = { ...bests, ...saved, [labCase.id]: Math.max(score, bests[labCase.id] ?? 0, saved[labCase.id] ?? 0) };
    setBests(next);
    try {
      window.localStorage.setItem(LAB_PROGRESS_KEY, JSON.stringify(next));
    } catch {
      // A score still appears in this session if saving is unavailable.
    }
  }

  return (
    <main className={`play-shell ${styles.shell}`}>
      <div className="game-heading">
        <h1>Estimation Lab</h1>
        <Link className="btn quiet" href={labCase ? labPath : "/estimation"}>{labCase ? "Case board" : "Today's puzzle"}</Link>
      </div>
      {labCase ? <LabRun labCase={labCase} bests={bests} onScore={saveBest} /> : <LabBoard bests={bests} />}
    </main>
  );
}
