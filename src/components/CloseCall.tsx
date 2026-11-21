"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { MAX_RAW_LENGTH, parseNumber } from "@/lib/domain/numberParser";
import {
  PREMIERE, RANGE_BANDS, ROUND_NAMES, SHOW_RECORD_KEY, accumulateScore, factAmount, finishShow,
  makeEpisode, maxWager, rangeBounds, readShowRecord, scoreShowRound,
  type Episode, type Scoreboard, type ShowPick, type ShowResult, type ShowRound,
} from "@/lib/domain/close-call";
import type { Rat } from "@/lib/domain/decimal";
import { useShowAudio } from "./useShowAudio";
import styles from "./CloseCall.module.css";

const path = "/estimation/close-call";
const integer = new Intl.NumberFormat("en-US", { maximumSignificantDigits: 7 });
const scientific = new Intl.NumberFormat("en-US", { notation: "scientific", maximumSignificantDigits: 4 });
const roundTabs = ["Opening", "Second", "Hi / Lo", "Window", "Final"];

function digits(amount: number | Rat) {
  const value = typeof amount === "number" ? amount : Number(amount.n) / Number(amount.d);
  return (value > 0 && value < 0.00001 || value >= 1e15 ? scientific : integer).format(value);
}

function readRecord() {
  try {
    return readShowRecord(window.localStorage.getItem(SHOW_RECORD_KEY));
  } catch {
    return readShowRecord(null);
  }
}

function Portrait({ house = false }: { house?: boolean }) {
  return <span className={`${styles.portrait} ${house ? styles.robot : styles.contestant}`} aria-hidden="true"><i /><b /></span>;
}

function Board({ score }: { score: Scoreboard }) {
  return (
    <div className={styles.scoreboard} aria-label="Scoreboard">
      <div className={`${styles.scorePocket} ${styles.you}`}>
        <Portrait />
        <div><span>You</span><strong key={score.you}>{score.you}</strong></div>
      </div>
      <span className={styles.versus} aria-hidden="true">VS</span>
      <div className={`${styles.scorePocket} ${styles.house}`}>
        <Portrait house />
        <div><span>House</span><strong key={score.house}>{score.house}</strong></div>
      </div>
    </div>
  );
}

function RoundRail({ index, results }: { index: number; results: ShowResult[] }) {
  return (
    <ol className={styles.roundRail} aria-label="Match rounds">
      {roundTabs.map((label, i) => {
        const result = results[i];
        const outcome = result && (result.change.you > result.change.house ? "win" : result.change.you < result.change.house ? "loss" : "draw");
        return (
          <li key={label} aria-current={i === index ? "step" : undefined} data-outcome={outcome || undefined}>
            <span aria-hidden="true">{result ? outcome === "draw" ? "=" : outcome === "win" ? "+" : "−" : i + 1}</span>
            <strong>{label}</strong>
            <span className="sr-only">{outcome ? `Round ${outcome}` : ""}</span>
          </li>
        );
      })}
    </ol>
  );
}

function Cover({ start, target, record, invalid }: {
  start: () => void;
  target?: number;
  record: ReturnType<typeof readShowRecord>;
  invalid: boolean;
}) {
  return (
    <section className={styles.cover} aria-labelledby="show-title">
      <div className={styles.coverCopy}>
        <p className={styles.kicker}><span aria-hidden="true" /> The estimation game show</p>
        <h1 id="show-title">Close <em>Call</em></h1>
        <p className={styles.pitch}>Make the better guess. Beat the House.</p>
        {target !== undefined ? <p className={styles.invitation}>Score to beat <strong>{target} points</strong></p> : null}
        {invalid ? <p className={styles.invitation}>That episode is unavailable. A new match is ready.</p> : null}
        <button className={styles.primary} type="button" onClick={start}>
          {target !== undefined ? "Play the challenge" : "Play Close Call"} <span aria-hidden="true">↗</span>
        </button>
        <p className={styles.coverFoot}>{record.played ? `${record.wins} ${record.wins === 1 ? "win" : "wins"} · Best ${record.best} pts` : "5 rounds · Untimed · No sign-up"}</p>
      </div>
      <div className={styles.coverArt}>
        <div className={styles.broadcastArt}>
          <div className={styles.studioLabel}>Roughly Right Studio</div>
          <Board score={{ you: 0, house: 0 }} />
          <div className={styles.marquee}>Guesses <span aria-hidden="true">✦</span> High / Low <span aria-hidden="true">✦</span> Final wager</div>
        </div>
        <p>The House is a computer. You both face the same questions.</p>
      </div>
    </section>
  );
}

function MatchInput({ round, index, score, onPick }: { round: ShowRound; index: number; score: Scoreboard; onPick: (pick: ShowPick) => void }) {
  const [input, setInput] = useState("");
  const [error, setError] = useState("");
  const [band, setBand] = useState(1);
  const [wager, setWager] = useState(0);
  const heading = useRef<HTMLHeadingElement>(null);
  const parsed = parseNumber(input, "measured", round.fact.unit);
  const reaches = round.kind === "window" && parsed.ok ? rangeBounds(parsed.value, band) : null;
  const max = maxWager(score);
  const stakes = Array.from(new Set([0, Math.floor(max / 2), max]));

  useEffect(() => { heading.current?.focus({ preventScroll: true }); }, []);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (round.kind === "direction") return;
    if (!parsed.ok) {
      setError(parsed.message);
      return;
    }
    if (round.kind === "window") onPick({ kind: "window", guess: parsed.value, band });
    else if (round.kind === "final") onPick({ kind: "final", guess: parsed.value, wager });
    else onPick({ kind: "estimate", guess: parsed.value });
  }

  return (
    <section className={styles.question} aria-labelledby="show-question">
      <div className={styles.questionHead}><span>Round {index + 1} / {ROUND_NAMES.length} · {ROUND_NAMES[index]}</span><span>{round.fact.category}</span></div>
      <h2 id="show-question" tabIndex={-1} ref={heading}>{round.fact.prompt}</h2>
      {round.kind === "direction" ? (
        <div className={styles.direction}>
          <p className={styles.benchmark}><span>The line</span><strong>{digits(round.benchmark)} {round.fact.unit}</strong></p>
          <p>Call higher or lower than the line. Get it right for 100 points.</p>
          <div className={styles.directionButtons}>
            <button type="button" onClick={() => onPick({ kind: "direction", direction: "lower" })}><span aria-hidden="true">↓</span> Lower</button>
            <button type="button" onClick={() => onPick({ kind: "direction", direction: "higher" })}><span aria-hidden="true">↑</span> Higher</button>
          </div>
        </div>
      ) : (
        <form className={styles.form} onSubmit={submit}>
          {round.kind === "final" ? (
            <fieldset className={styles.choiceSet}>
              <legend>{max > 0 ? "Put points on the line" : "Final guess"}</legend>
              <p>{max > 0 ? "The closer estimate takes the wager from the other player." : "The closer you get, the more points you earn."}</p>
              {max > 0 ? <div className={styles.choices}>
                {stakes.map((value) => (
                  <label key={value}>
                    <input type="radio" name="show-wager" value={value} checked={wager === value} onChange={() => setWager(value)} />
                    <span>{value ? `${value} pts` : "No wager"}</span>
                  </label>
                ))}
              </div> : null}
              {wager > 0 ? <p className={styles.stakeImpact}>A {wager}-point wager moves the gap by {wager * 2} points.</p> : null}
            </fieldset>
          ) : null}
          {round.kind === "window" ? (
            <fieldset className={styles.choiceSet}>
              <legend>Pick your range</legend>
              <p>A tighter range pays more if it contains the answer.</p>
              <div className={styles.choices}>
                {RANGE_BANDS.map((range, i) => (
                  <label key={range.label}>
                    <input type="radio" name="show-range" value={i} checked={band === i} onChange={() => setBand(i)} />
                    <span>{range.label}<small>×/÷ {digits(range.factor)} · {range.points} pts</small></span>
                  </label>
                ))}
              </div>
            </fieldset>
          ) : null}
          <label className={styles.inputLabel} htmlFor="show-guess">{round.kind === "window" ? "Centre of your range" : "Your estimate"} <span>({round.fact.unit})</span></label>
          <div className={styles.lockRow}>
            <input id="show-guess" type="text" inputMode="decimal" autoComplete="off" maxLength={MAX_RAW_LENGTH} value={input}
              onChange={(event) => { setInput(event.target.value); setError(""); }} aria-invalid={error ? true : undefined}
              aria-describedby="show-format" placeholder="Enter a number" />
            <button className={styles.primary} type="submit" disabled={!input.trim()}>{round.kind === "final" ? "Lock final answer" : "Lock it in"} <span aria-hidden="true">↵</span></button>
          </div>
          <p id="show-format" className={error ? styles.error : styles.format} role={error ? "alert" : undefined}>
            {error || (reaches ? `Your range is ${digits(reaches.low)} to ${digits(reaches.high)} ${round.fact.unit}.` : "3k and 3,000 are both fine.")}
          </p>
        </form>
      )}
    </section>
  );
}

function callText(round: ShowRound, pick: ShowPick) {
  const unit = round.fact.unit;
  if (round.kind === "direction" && pick.kind === "direction") return {
    you: pick.direction === "higher" ? "Higher" : "Lower", house: round.houseCall === "higher" ? "Higher" : "Lower",
  };
  if (round.kind === "window" && pick.kind === "window") {
    const width = ({ low, high }: ReturnType<typeof rangeBounds>) => `${digits(low)}–${digits(high)} ${unit}`;
    return { you: width(rangeBounds(pick.guess, pick.band)), house: width(rangeBounds(factAmount(round.houseGuess), round.houseBand)) };
  }
  if ("houseGuess" in round && "guess" in pick) return { you: `${digits(pick.guess)} ${unit}`, house: `${digits(round.houseGuess)} ${unit}` };
  return { you: "", house: "" };
}

function signed(points: number) { return points >= 0 ? `+${points}` : `−${Math.abs(points)}`; }

function Reveal({ round, index, result, score, advance }: { round: ShowRound; index: number; result: ShowResult; score: Scoreboard; advance: () => void }) {
  const heading = useRef<HTMLHeadingElement>(null);
  const calls = callText(round, result.pick);
  const verdict = result.change.you > result.change.house ? "You take the round" : result.change.you < result.change.house ? "House takes the round" : "Even round";
  const wager = result.pick.kind === "final" ? result.pick.wager : 0;
  const lead = score.you - score.house;
  const previousLead = lead - result.change.you + result.change.house;
  const changedLeader = index > 0 && previousLead * lead < 0;
  useEffect(() => { heading.current?.focus({ preventScroll: true }); }, []);

  return (
    <section className={`${styles.question} ${styles.reveal}`} aria-labelledby="show-verdict">
      <div className={styles.questionHead}><span>Round {index + 1} · Answer reveal</span><span>{round.fact.category}</span></div>
      <h2 id="show-verdict" tabIndex={-1} ref={heading}>{verdict}</h2>
      {changedLeader ? <p className={styles.leadChange}>{lead > 0 ? "You overtake the House." : "The House takes the lead."}</p> : null}
      <p className={styles.answer}>{digits(round.fact.value)} <small>{round.fact.unit}</small></p>
      <div className={styles.roundScores}>
        <div className={styles.yourLine}><strong>You</strong><span>{calls.you}</span><b>{signed(result.change.you)}</b></div>
        <div className={styles.houseLine}><strong>House</strong><span>{calls.house}</span><b>{signed(result.change.house)}</b></div>
      </div>
      {wager ? <p className={styles.transfer}>{result.transfer === 0 ? "Dead heat. No points change hands." : result.transfer > 0 ? `You take ${result.transfer} points from the House.` : `The House takes ${Math.abs(result.transfer)} of your points.`}</p> : null}
      <p className={styles.factNote}>{round.fact.note} <a href={round.fact.source.url} target="_blank" rel="noreferrer">{round.fact.source.label} ↗</a></p>
      <button className={styles.primary} type="button" onClick={advance}>{index === ROUND_NAMES.length - 1 ? "See the final score" : `Next: ${ROUND_NAMES[index + 1]}`} <span aria-hidden="true">→</span></button>
    </section>
  );
}

function Results({ score, episode, rematch, target, record }: {
  score: Scoreboard;
  episode: Episode;
  rematch: () => void;
  target?: number;
  record: ReturnType<typeof readShowRecord>;
}) {
  const title = score.you === score.house ? "It’s a draw." : score.you > score.house ? "You beat the House." : "House wins.";
  const heading = useRef<HTMLHeadingElement>(null);
  const [share, setShare] = useState<{ href: string; copied: boolean } | null>(null);
  const difference = Math.abs(score.you - score.house);
  useEffect(() => { heading.current?.focus({ preventScroll: true }); }, []);

  async function copy() {
    const href = new URL(path, window.location.origin);
    href.searchParams.set("episode", episode.code);
    href.searchParams.set("target", String(score.you));
    try {
      await navigator.clipboard.writeText(`Roughly Right: Close Call\nI scored ${score.you} against the House. Same episode, same opponent. Can you beat it?\n${href}`);
      setShare({ href: href.toString(), copied: true });
    } catch {
      setShare({ href: href.toString(), copied: false });
    }
  }

  return (
    <section className={`${styles.question} ${styles.result}`} aria-labelledby="show-result">
      <div className={styles.questionHead}><span>Final score</span><span>Full match</span></div>
      <h2 id="show-result" ref={heading} tabIndex={-1}>{title}</h2>
      <p>{difference ? `${difference} ${difference === 1 ? "point" : "points"} between you.` : "Same score, same stage."}{target !== undefined ? ` ${score.you > target ? "Challenge beaten." : score.you === target ? "You matched the challenge score." : "The challenge score holds."}` : ""}</p>
      {record.played ? <p className={styles.record}>Best {record.best} pts · {record.wins} {record.wins === 1 ? "win" : "wins"} in {record.played} {record.played === 1 ? "match" : "matches"}{record.streak > 1 ? ` · ${record.streak} in a row` : ""}</p> : null}
      <div className={styles.resultActions}>
        <button className={styles.primary} type="button" onClick={rematch}>Rematch <span aria-hidden="true">↗</span></button>
        <button className={styles.secondary} type="button" onClick={copy}>Share this episode</button>
      </div>
      {share ? (
        <p role="status" className={styles.shareText}>
          {share.copied ? "Challenge copied. " : "Share this link. "}<Link href={share.href}>Open challenge</Link>
          {!share.copied ? <input aria-label="Challenge link" type="text" value={share.href} readOnly onFocus={(event) => event.currentTarget.select()} /> : null}
        </p>
      ) : null}
    </section>
  );
}

export default function CloseCall({ challenge, challengedScore, invalid = false }: {
  challenge?: Episode;
  challengedScore?: number;
  invalid?: boolean;
}) {
  const [episode, setEpisode] = useState<Episode | null>(null);
  const [index, setIndex] = useState(0);
  const [results, setResults] = useState<ShowResult[]>([]);
  const [record, setRecord] = useState(() => readShowRecord(null));
  const { muted, toggleMute, play } = useShowAudio();
  const feedback = useRef<number | null>(null);
  const handled = useRef(-1);
  const score = accumulateScore(results);
  const round = episode?.rounds[index];
  const result = results[index];
  const target = !episode || episode.code === challenge?.code ? challengedScore : undefined;

  useEffect(() => {
    setRecord(readRecord());
    return () => { if (feedback.current !== null) window.clearTimeout(feedback.current); };
  }, []);

  function start(rematch: boolean) {
    if (feedback.current !== null) window.clearTimeout(feedback.current);
    const saved = readRecord();
    const next = rematch ? makeEpisode(episode?.rounds.map(({ fact }) => fact.id))
      : challenge ?? (Math.max(saved.played, record.played) ? makeEpisode() : PREMIERE);
    setEpisode(next);
    setIndex(0);
    setResults([]);
    handled.current = -1;
    play("start");
  }

  function lock(pick: ShowPick) {
    if (!round || handled.current === index) return;
    const resolved = scoreShowRound(round, pick, score);
    if (!resolved) return;
    handled.current = index;
    const next = [...results, resolved];
    setResults(next);
    play("lock");
    feedback.current = window.setTimeout(() => {
      play(resolved.change.you > resolved.change.house ? "hit" : resolved.change.you < resolved.change.house ? "miss" : "turn");
    }, 180);
    if (next.length === ROUND_NAMES.length) {
      const saved = readRecord();
      const updated = finishShow(saved.played < record.played ? record : saved, accumulateScore(next));
      setRecord(updated);
      try {
        window.localStorage.setItem(SHOW_RECORD_KEY, JSON.stringify(updated));
      } catch {
        // The result still counts for this session when storage is unavailable.
      }
    }
  }

  function advance() {
    if (!result) return;
    if (feedback.current !== null) window.clearTimeout(feedback.current);
    play(index === ROUND_NAMES.length - 1 ? score.you > score.house ? "win" : score.you < score.house ? "loss" : "turn" : "turn");
    setIndex((previous) => Math.min(previous + 1, ROUND_NAMES.length));
  }

  return (
    <div className={styles.show} data-playing={episode ? "true" : undefined}>
      <div className={styles.controlBar}>
        {episode ? <h1>Close Call</h1> : null}
        <button className={styles.sound} type="button" aria-label="Sound" aria-pressed={!muted} onClick={toggleMute}>Sound {muted ? "off" : "on"}</button>
      </div>
      {episode ? (
        <div className={styles.playfield}>
          <Board score={score} />
          <RoundRail index={index} results={results} />
          {target !== undefined && round ? <p className={styles.target}>Challenge target <strong>{target} pts</strong></p> : null}
          {round ? result ? <Reveal key={`r${index}`} round={round} index={index} result={result} score={score} advance={advance} />
            : <MatchInput key={`q${index}`} round={round} index={index} score={score} onPick={lock} />
            : <Results score={score} episode={episode} rematch={() => start(true)} target={target} record={record} />}
        </div>
      ) : <Cover start={() => start(false)} target={target} record={record} invalid={invalid} />}
      <details className={styles.rules}>
        <summary>How to play</summary>
        <ol>
          <li>In an estimate round, closer earns more points. Double or half the answer earns 50.</li>
          <li>Call high or low for 100 points, then choose how narrow a range you’ll risk.</li>
          <li>The final estimate can move the wager from one score to the other. Only the closer guess takes it.</li>
        </ol>
        <p>The House’s estimates are fixed for each episode. A challenge link gives your friend the same questions and opponent.</p>
      </details>
    </div>
  );
}
