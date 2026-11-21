"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import type { AttemptState, RoundResolved } from "@/lib/dto";
import { parseNumber, formatDisplay } from "@/lib/domain/numberParser";
import { SIBLING_GAMES } from "@/lib/site";
import ScoreRing from "@/components/ScoreRing";
import PixelSprite from "@/components/pixel/PixelSprite";
import PixelConfetti from "@/components/PixelConfetti";
import GuessGraph from "@/components/GuessGraph";
import AnimatedSprite from "@/components/pixel/AnimatedSprite";
import { HOURGLASS, PALETTES } from "@/components/pixel/sprites";
import { CALC, CALC_PALETTE, OWL, OWL_PALETTE, RULER, RULER_PALETTE, TARGET, TARGET_PALETTE } from "@/components/pixel/art";
import { sound } from "@/lib/sound";
import { MARK_ICONS, markClass } from "@/lib/marks";

type Props = {
  mode: "daily" | "archive";
  date?: string;
};

type Suggestion = { label: string; disambiguator: string | null };

function requestId(): string {
  return crypto.randomUUID?.() ?? Array.from(crypto.getRandomValues(new Uint8Array(16)), (n) => n.toString(16).padStart(2, "0")).join("");
}

async function api(path: string, body?: unknown, signal?: AbortSignal): Promise<{ data: Record<string, unknown> }> {
  try {
    const res = await fetch(path, {
      method: body === undefined ? "GET" : "POST",
      headers: body === undefined ? undefined : { "content-type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal,
    });
    return { data: await res.json() };
  } catch {
    return { data: { ok: false, message: "Couldn’t reach the game. Try again in a moment." } };
  }
}

const MARK_EMOJI: Record<string, string> = {
  Exact: "\u2b50",
  Close: "\ud83d\udfe2",
  "In range": "\ud83d\udfe1",
  Far: "\ud83d\udd34",
  Pass: "\u26aa",
};

/** Text share card: game, number, marks and total. Never prompts or answers. */
function shareText(recap: NonNullable<AttemptState["recap"]>): string {
  const marks = recap.rounds.map((r) => MARK_EMOJI[r.mark] ?? "\u26aa").join("");
  return `Roughly Right · ${recap.mode === "archive" ? "Archive" : "Daily"} #${recap.displayNumber}\n${recap.total}/${recap.maxTotal} ${marks}`;
}

function markChip(r: { points: number; mark: string }): string {
  return `${MARK_ICONS[r.mark] ?? ""} ${r.mark} · ${r.points}`;
}

/** Animated count-up toward a target (used by the HUD score). */
function useCountUp(target: number): number {
  const [shown, setShown] = useState(target);
  const raf = useRef<number>(0);
  useEffect(() => {
    const from = shown;
    if (from === target) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setShown(target);
      return;
    }
    const start = performance.now();
    const dur = 450;
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / dur);
      const eased = 1 - Math.pow(1 - p, 3);
      setShown(Math.round(from + (target - from) * eased));
      if (p < 1) raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target]);
  return shown;
}

const ROUND_TYPES = {
  direct_fact: { label: "Know the scale", sprite: RULER, palette: RULER_PALETTE },
  calculation: { label: "Back of the envelope", sprite: CALC, palette: CALC_PALETTE },
  target_match: { label: "Match the target", sprite: TARGET, palette: TARGET_PALETTE },
};

function RoundTypePill({ type }: { type: keyof typeof ROUND_TYPES }) {
  const { label, sprite, palette } = ROUND_TYPES[type];
  return (
    <span className="eyebrow round-pill">
      <PixelSprite sprite={sprite} palette={palette} size={24} /> {label}
    </span>
  );
}

export default function EstimationGame({ mode, date }: Props) {
  const [state, setState] = useState<AttemptState | null>(null);
  const [phase, setPhase] = useState<"boot" | "play" | "unavailable">("boot");
  const [notice, setNotice] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [activeSuggestion, setActiveSuggestion] = useState(-1);
  const [suggestionsOpen, setSuggestionsOpen] = useState(false);
  const [hintOpen, setHintOpen] = useState(false);
  const [hintLoading, setHintLoading] = useState(false);
  const [hintError, setHintError] = useState<string | null>(null);
  const [hint, setHint] = useState<{ text?: string; figure?: { value: string; unit: string; scope?: string }; image?: { url: string; alt: string; credit: string; rights: string } } | null>(null);
  const [imgFailed, setImgFailed] = useState(false);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [comparison, setComparison] = useState(false);
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const [sharing, setSharing] = useState(false);
  const [muted, setMuted] = useState(true); // matches the off-by-default engine; synced below
  const [browse, setBrowse] = useState(false);
  const [suggestion, setSuggestion] = useState<string | null>(null);
  const chosenLabel = useRef("");

  useEffect(() => {
    setMuted(sound.isMuted());
  }, []);
  const inputRef = useRef<HTMLInputElement>(null);
  const nextRef = useRef<HTMLButtonElement>(null);
  const questionRef = useRef<HTMLHeadingElement>(null);
  // Called unconditionally (hook order must be stable across phases).
  const hudScore = useCountUp(state?.score ?? 0);

  // One click to play: opening the page starts (or resumes) today's game
  // immediately. startOrResume is idempotent, so double mounts are safe.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await api("/api/estimation/start", { game: "estimation", mode, date });
      if (cancelled) return;
      if (data.ok && data.state) {
        setState(data.state as AttemptState);
        setPhase("play");
      } else {
        setNotice(String(data.message ?? "Unavailable."));
        setPhase("unavailable");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [mode, date]);

  useEffect(() => {
    if (state?.resolved) {
      nextRef.current?.focus({ preventScroll: true });
    } else if (state?.prompt) {
      const coarsePointer = window.matchMedia("(pointer: coarse)").matches;
      (coarsePointer ? questionRef.current : inputRef.current)?.focus({ preventScroll: true });
    }
  }, [state?.attemptId, state?.resolved, state?.prompt?.ordinal]);

  // Reset per-round UI state when the open round changes.
  useEffect(() => {
    setInput("");
    setSuggestions([]);
    setActiveSuggestion(-1);
    setSuggestionsOpen(false);
    setBrowse(false);
    chosenLabel.current = "";
    setHint(null);
    setHintOpen(false);
    setHintLoading(false);
    setHintError(null);
    setImgFailed(false);
    setNotice(null);
    setSuggestion(null);
  }, [state?.attemptId, state?.ordinal]);

  // The tab title tracks progress, so players with several tabs open can see
  // where they are at a glance.
  useEffect(() => {
    if (!state) return;
    if (state.state === "active") document.title = `Round ${state.ordinal}/5 · Roughly Right`;
    else if (state.recap) document.title = `${state.recap.total}/500 · Roughly Right`;
  }, [state]);

  const begin = useCallback(
    async () => {
      setBusy(true);
      const { data } = await api("/api/estimation/start", {
        game: "estimation",
        mode,
        date,
      });
      setBusy(false);
      if (data.ok && data.state) {
        setState(data.state as AttemptState);
        setPhase("play");
        setNotice(null);
      } else {
        setNotice(String(data.message ?? "Unavailable."));
        setPhase("unavailable");
      }
    },
    [mode, date],
  );

  // Live parse preview (client-side mirror of the server grammar; the server is authoritative).
  const prompt = state?.prompt ?? null;
  const preview = useMemo(() => {
    if (!prompt || prompt.roundType === "target_match") return null;
    const raw = input;
    if (!raw.trim()) return null;
    const parsed = parseNumber(raw, prompt.countMode ? "count" : "measured", prompt.unit);
    if (!parsed.ok) return { valid: false, text: parsed.message };
    return {
      valid: true,
      text: `${raw.trim()} → ${formatDisplay(parsed.canonical)} ${prompt.unit}`,
    };
  }, [input, prompt]);

  useEffect(() => {
    if (!prompt || prompt.roundType !== "target_match" || !state || state.resolved) return;
    const q = input.trim();
    if (!browse && (q.length < 3 || q === chosenLabel.current)) {
      setSuggestions([]);
      setSuggestionsOpen(false);
      return;
    }
    const controller = new AbortController();
    const params = new URLSearchParams({ attemptId: state.attemptId, ordinal: String(state.ordinal), q: browse ? "" : q });
    if (browse) params.set("browse", "1");
    const t = setTimeout(async () => {
      const { data } = await api(`/api/estimation/suggest?${params}`, undefined, controller.signal);
      if (controller.signal.aborted) return;
      if (data.ok && Array.isArray(data.suggestions)) {
        setSuggestions(data.suggestions as Suggestion[]);
        setActiveSuggestion(-1);
        setSuggestionsOpen(data.suggestions.length > 0);
      } else if (browse) {
        setNotice(String(data.message ?? "Choices are temporarily unavailable."));
      }
    }, browse ? 0 : 180);
    return () => {
      controller.abort();
      clearTimeout(t);
    };
  }, [browse, input, prompt, state]);

  // Error juice: a quick horizontal shake on the input row (Web Animations
  // API, so the input is never remounted and focus/suggestions survive).
  const shakeRow = useCallback(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    inputRef.current?.parentElement?.animate(
      [
        { transform: "translateX(0)" },
        { transform: "translateX(-6px)" },
        { transform: "translateX(5px)" },
        { transform: "translateX(-3px)" },
        { transform: "translateX(0)" },
      ],
      { duration: 320, easing: "ease-in-out" },
    );
  }, []);

  const restore = useCallback(async (attemptId: string): Promise<boolean> => {
    const { data } = await api("/api/estimation/state", { attemptId });
    if (!data.ok || !data.state) return false;
    setState(data.state as AttemptState);
    return true;
  }, []);

  const lock = useCallback(
    async (pass: boolean, overrideInput?: string) => {
      if (!state || !state.prompt || busyRef.current) return;
      const value = overrideInput ?? input;
      busyRef.current = true;
      setBusy(true);
      setNotice(null);
      setSuggestion(null);
      const ord = state.ordinal;
      const body: Record<string, unknown> = { attemptId: state.attemptId, ordinal: ord, requestId: requestId() };
      if (pass) body.pass = true;
      else if (prompt?.roundType === "target_match") body.entity = value;
      else body.guess = value;
      const { data } = await api("/api/estimation/resolve", body);
      if (data.ok && data.state) {
        const nextState = data.state as AttemptState;
        setState(nextState);
        // Play appropriate sensory tone
        if (pass) {
          sound.pass();
        } else if (nextState.resolved) {
          const m = nextState.resolved.mark;
          if (m === "Exact" || m === "Close") sound.success();
          else if (m === "In range") sound.warm();
          else sound.far();
        }
      } else if (!((data.code === "stale" || data.code === "expired") && await restore(state.attemptId))) {
        sound.far();
        setNotice(String(data.message ?? "Something went wrong — try again."));
        setSuggestion(typeof data.suggestion === "string" ? data.suggestion : null);
        if (typeof data.code === "string" && data.code === "invalid_input") shakeRow();
      }
      busyRef.current = false;
      setBusy(false);
    },
    [state, prompt, input, restore, shakeRow],
  );

  const next = useCallback(async () => {
    if (!state || busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    setNotice(null);
    const { data } = await api("/api/estimation/advance", {
      attemptId: state.attemptId,
      ordinal: state.ordinal,
      requestId: requestId(),
    });
    if (data.ok && data.state) setState(data.state as AttemptState);
    else if (!((data.code === "stale" || data.code === "expired") && await restore(state.attemptId))) {
      setNotice(String(data.message ?? "Something went wrong. Try again."));
    }
    busyRef.current = false;
    setBusy(false);
  }, [state, restore]);

  useEffect(() => {
    if (!hintOpen || hint || hintError || !state?.prompt?.hintAvailable || state.resolved) return;
    const controller = new AbortController();
    setHintLoading(true);
    void api("/api/estimation/hint", { attemptId: state.attemptId, ordinal: state.ordinal }, controller.signal)
      .then(({ data }) => {
        if (controller.signal.aborted) return;
        setHintLoading(false);
        if (data.ok) setHint(data.hint as typeof hint);
        else setHintError(String(data.message ?? "Hint unavailable."));
      });
    return () => controller.abort();
  }, [hintOpen, hint, hintError, state]);

  async function createShare(withComparison: boolean): Promise<void> {
    if (!state?.recap || sharing) return;
    setSharing(true);
    const { data } = await api("/api/estimation/share", { attemptId: state.attemptId, comparison: withComparison });
    setSharing(false);
    if (data.ok && typeof data.token === "string") {
      const url = `${window.location.origin}/estimation/result/${data.token}`;
      setShareUrl(url);
      const text = shareText(state.recap);
      if (navigator.share) {
        try {
          await navigator.share({ title: "Roughly Right", text, url });
          return;
        } catch (error) {
          if (error instanceof DOMException && error.name === "AbortError") return;
        }
      }
      try {
        await navigator.clipboard.writeText(`${text}\n${url}`);
        setNotice("Result copied to your clipboard.");
      } catch {
        setNotice("Copy failed. You can select the link below.");
      }
    } else {
      setNotice(String(data.message ?? "Share failed."));
    }
  }

  if (phase === "boot") {
    return (
      <main className="play-shell">
        <div className="hero">
          <div className="pixel-loader" aria-hidden="true"><i /><i /><i /></div>
          <p className="muted" role="status">Opening puzzle…</p>
        </div>
      </main>
    );
  }
  if (phase === "unavailable") {
    return (
      <main>
        <div className="hero">
          <AnimatedSprite name="oscilloscope" palette={PALETTES.oscilloscope} size={44} className="hero-mascot" />
          <h1>Estimation</h1>
        </div>
        <div className="card">
          <p role="alert">{notice ?? "The daily is unavailable right now."}</p>
          <div className="actions">
            <button onClick={begin} disabled={busy}>{busy ? "Opening…" : "Try again"}</button>
            <Link className="btn primary" href="/estimation/close-call">Play Close Call</Link>
            <Link className="btn" href="/estimation/lab">Open the Lab</Link>
            <Link className="btn" href="/estimation/archive">Archive</Link>
          </div>
        </div>
      </main>
    );
  }

  if (!state) return null;

  if (state.state === "expired") {
    return (
      <main>
        <div className="hero">
          <PixelSprite sprite={HOURGLASS} palette={PALETTES.hourglass} size={38} className="hero-mascot" />
          <span className="chip">Time&apos;s up</span>
          <h1>
            The window <span className="grad-text">closed</span>
          </h1>
        </div>
        <div className="card">
          <p className="muted" role="alert">
            This daily closed at 00:30 UTC. The archive has an unranked run for the same date.
          </p>
          <div className="actions">
            <Link className="btn primary" href={`/estimation/archive/${state.puzzleDate}`}>Replay unranked</Link>
            <Link className="btn" href="/estimation/archive">Archive</Link>
            <Link className="btn" href="/">Home</Link>
          </div>
        </div>
      </main>
    );
  }

  if (state.recap) {
    return <RecapView sharing={sharing} state={state} shareUrl={shareUrl} setShareUrl={setShareUrl} comparison={comparison} setComparison={setComparison} onShare={createShare} notice={notice} />;
  }

  const resolved = state.resolved;

  const choicesVisible = suggestionsOpen && suggestions.length > 0;

  return (
    <main className="play-shell">
      <div className="game-heading">
        <div>
          <p className="eyebrow">{state.mode === "daily" ? "Daily" : "Archive"} #{state.displayNumber}</p>
          <h1>{state.themeTag ?? "Estimation"}</h1>
        </div>
        <Link className="btn quiet" href="/estimation/archive">Archive</Link>
      </div>
      <div className="hud">
        <RoundStepper ordinal={state.ordinal} resolved={!!resolved} />
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <button
            type="button"
            className="sound-toggle-btn"
            onClick={() => {
              const nowMuted = sound.toggleMute();
              setMuted(nowMuted);
            }}
            title={muted ? "Unmute audio effects" : "Mute audio effects"}
            aria-label={muted ? "Unmute audio effects" : "Mute audio effects"}
            aria-pressed={!muted}
          >
            {muted ? "🔇" : "🔊"}
          </button>
          <span className="score-pill" aria-label={`${state.score} of 500 points`}><span aria-hidden="true">{hudScore} / 500</span></span>
        </div>
      </div>

      {resolved ? (
        <section key={`r${state.ordinal}`} className="card resolved-card" aria-labelledby="round-result">
          <p className="eyebrow">Round {state.ordinal} of 5</p>
          <h2 className="prompt-text" id="round-result">{resolved.promptText}</h2>
          <div className="round-answer" aria-live="polite">
            <div>
              <span className="eyebrow">{resolved.reveal.benchmarkLabel ?? "Target"}</span>
              <strong>{resolved.reveal.targetDisplay} {resolved.reveal.unit}</strong>
            </div>
            <span className={markClass(resolved.mark)}>{MARK_ICONS[resolved.mark]} {resolved.mark} · {resolved.points} pts</span>
          </div>
          {resolved.mark === "Exact" ? <PixelConfetti count={48} /> : null}
          <GuessGraph resolved={resolved} />
          <RevealDetails r={resolved} />
          {notice ? <p className="notice" role="alert">{notice}</p> : null}
          <div className="actions">
            <button ref={nextRef} className="primary" onClick={next} disabled={busy}>
              {busy ? "Opening…" : state.ordinal === 5 ? "See results" : "Next question"} <span aria-hidden="true">→</span>
            </button>
          </div>
        </section>
      ) : prompt ? (
        <section key={`q${state.ordinal}`} className="card question-card" aria-labelledby="round-question">
          <div className="q-head">
            <RoundTypePill type={prompt.roundType} />
            {prompt.category ? <span className="round-category">{prompt.category}</span> : null}
          </div>
          <h2 className="prompt-text" id="round-question" tabIndex={-1} ref={questionRef}>{prompt.prompt}</h2>
          {prompt.scope ? <p className="muted q-scope">{prompt.scope}</p> : null}

          {prompt.roundType === "target_match" ? (
            <>
              <label htmlFor="guess">Your answer</label>
              <div className="input-row">
                <input
                  id="guess"
                  role="combobox"
                  aria-autocomplete="list"
                  maxLength={200}
                  aria-expanded={choicesVisible}
                  aria-controls={choicesVisible ? "choices" : undefined}
                  aria-activedescendant={choicesVisible && activeSuggestion >= 0 ? `choice-${activeSuggestion}` : undefined}
                  ref={inputRef}
                  type="text"
                  autoComplete="off"
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                  inputMode="text"
                  enterKeyHint="done"
                  value={input}
                  readOnly={busy}
                  onChange={(e) => {
                    setInput(e.target.value);
                    chosenLabel.current = "";
                    setBrowse(false);
                    setSuggestions([]);
                    setActiveSuggestion(-1);
                    setSuggestionsOpen(false);
                    setNotice(null);
                    setSuggestion(null);
                  }}
                  onKeyDown={(e) => {
                    if (e.nativeEvent.isComposing) return;
                    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
                      e.preventDefault();
                      if (suggestions.length > 0) {
                        const delta = e.key === "ArrowDown" ? 1 : -1;
                        setSuggestionsOpen(true);
                        setActiveSuggestion((i) => i < 0
                          ? delta > 0 ? 0 : suggestions.length - 1
                          : (i + delta + suggestions.length) % suggestions.length);
                      }
                    } else if (e.key === "Enter") {
                      e.preventDefault();
                      if (suggestionsOpen && activeSuggestion >= 0 && suggestions[activeSuggestion]) {
                        applySuggestion(suggestions[activeSuggestion]);
                      } else if (input.trim()) {
                        lock(false);
                      }
                    } else if (e.key === "Escape") {
                      chosenLabel.current = input.trim();
                      setBrowse(false);
                      setSuggestionsOpen(false);
                    }
                  }}
                  aria-describedby="preview"
                  placeholder="Type a name"
                />
                <button type="button" aria-pressed={browse} disabled={busy} onClick={() => {
                  setBrowse(!browse);
                  setNotice(null);
                  setSuggestions([]);
                  setActiveSuggestion(-1);
                  setSuggestionsOpen(false);
                  if (!browse) inputRef.current?.focus();
                }}>{browse ? "Close list" : "Browse choices"}</button>
              </div>
              {choicesVisible ? (
                <ul className="suggestions" id="choices" role="listbox" aria-label="Eligible choices">
                  {suggestions.map((s, i) => (
                    <li key={`${s.label}-${s.disambiguator}`} id={`choice-${i}`} role="option" aria-selected={i === activeSuggestion}>
                      <button
                        type="button"
                        tabIndex={-1}
                        className={i === activeSuggestion ? "active" : undefined}
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => applySuggestion(s)}
                      >
                        {s.label}
                        {s.disambiguator ? ` (${s.disambiguator})` : ""}
                      </button>
                    </li>
                  ))}
                </ul>
              ) : null}
              <p className="muted small" id="preview">Pick one from the list or type a name and lock it in.</p>
            </>
          ) : (
            <>
              <label htmlFor="guess">Your estimate ({prompt.unit})</label>
              <div className="input-row">
                <input
                  id="guess"
                  ref={inputRef}
                  type="text"
                  autoComplete="off"
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                  inputMode="decimal"
                  enterKeyHint="go"
                  value={input}
                  readOnly={busy}
                  maxLength={200}
                  onChange={(e) => { setInput(e.target.value); setNotice(null); setSuggestion(null); }}
                  onKeyDown={(e) => {
                    if (!e.nativeEvent.isComposing && e.key === "Enter" && input.trim()) {
                      e.preventDefault();
                      lock(false);
                    }
                  }}
                  aria-describedby="preview"
                  placeholder={prompt.countMode ? "e.g. 5000 or 5k" : "e.g. 900 or 1.2k"}
                />
                <span className="unit-tag" aria-hidden="true">{prompt.unit}</span>
              </div>
              <div className="suffix-row" role="group" aria-label="Number suffixes">
                {[["k", "thousand"], ["m", "million"], ["b", "billion"]].map(([suffix, label]) => (
                  <button
                    key={suffix}
                    type="button"
                    className="suffix-chip"
                    disabled={busy || !/\d\s*$/.test(input)}
                    onClick={() => {
                      sound.click();
                      setInput(input.trimEnd() + suffix);
                      setNotice(null);
                      setSuggestion(null);
                      inputRef.current?.focus();
                    }}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <p id="preview" className={`preview${preview && !preview.valid ? " invalid" : ""}`} aria-live="polite">
                {preview?.valid ? "✓ " : preview && !preview.valid ? "⚠ " : ""}
                {preview?.text ?? (prompt.countMode ? "Enter a whole number. 5k works for 5,000." : "Enter a number. 1.2k works for 1,200.")}
              </p>
            </>
          )}

          {prompt.hintAvailable ? (
            <details className="hint" onToggle={(e) => setHintOpen(e.currentTarget.open)}>
              <summary>Show hint</summary>
              {hint ? (
                <HintContent hint={hint} imgFailed={imgFailed} setImgFailed={setImgFailed} />
              ) : hintError ? (
                <div className="hint-retry">
                  <p role="status" className="muted">{hintError}</p>
                  <button type="button" onClick={() => setHintError(null)}>Retry hint</button>
                </div>
              ) : hintLoading ? <p className="muted small" role="status">Loading hint…</p> : null}
            </details>
          ) : null}

          {notice ? (
            <div className="notice" role="alert">
              <span>{notice}</span>
              {suggestion ? (
                <button onClick={() => lock(false, suggestion)} disabled={busy}>Lock “{suggestion}” instead</button>
              ) : null}
            </div>
          ) : null}

          <div className="actions">
            <button className="primary" onClick={() => lock(false)} disabled={busy || input.trim().length === 0}>
              {busy ? "Submitting…" : "Lock guess"} <span className="kbd" aria-hidden="true">↵</span>
            </button>
            <button onClick={() => lock(true)} disabled={busy}>Pass</button>
          </div>
          {state.ordinal === 1 ? (
            <details className="round-help">
              <summary>How to play</summary>
              <p>Make one estimate per question. Closer guesses earn more points, up to 100 per round. Guessing twice the answer or half the answer earns 50 points either way.</p>
              <p>Hints are free. Passing earns zero points and shows the answer.</p>
            </details>
          ) : null}
        </section>
      ) : (
        <section className="card">
          <p role="status">Loading…</p>
          <button onClick={() => window.location.reload()}>Reload state</button>
        </section>
      )}
    </main>
  );

  function applySuggestion(s: Suggestion) {
    const text = s.disambiguator ? `${s.label} (${s.disambiguator})` : s.label;
    chosenLabel.current = text;
    setInput(text);
    setBrowse(false);
    setSuggestions([]);
    setActiveSuggestion(-1);
    setSuggestionsOpen(false);
    inputRef.current?.focus();
  }
}

function RoundStepper({ ordinal, resolved }: { ordinal: number; resolved: boolean }) {
  return (
    <div className="steps" aria-label={`Round ${ordinal} of 5`}>
      {[1, 2, 3, 4, 5].map((n) => {
        const done = n < ordinal || (n === ordinal && resolved);
        const current = n === ordinal && !resolved;
        return (
          <div key={n} className={`step${done ? " done" : ""}${current ? " current" : ""}`} aria-current={current ? "step" : undefined}>
            {n > 1 ? <span className={`link${done || current ? " done-fill" : ""}`} /> : null}
            <span className="dot">{done ? "✓" : n}</span>
          </div>
        );
      })}
    </div>
  );
}

function HintContent({
  hint,
  imgFailed,
  setImgFailed,
}: {
  hint: { text?: string; figure?: { value: string; unit: string; scope?: string }; image?: { url: string; alt: string; credit: string; rights: string } };
  imgFailed: boolean;
  setImgFailed: (v: boolean) => void;
}) {
  return (
    <div>
      {hint.image && !imgFailed ? (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="hint-img" src={hint.image.url} alt={hint.image.alt} onError={() => setImgFailed(true)} />
          <p className="muted small">{hint.image.credit} · {hint.image.rights}</p>
        </>
      ) : null}
      {imgFailed ? <p className="hint-fallback">The hint image couldn&apos;t load — the text below keeps this round usable.</p> : null}
      {hint.figure ? (
        <p>
          <strong>{formatDisplay(hint.figure.value)} {hint.figure.unit}</strong>
          {hint.figure.scope ? <span className="muted"> — {hint.figure.scope}</span> : null}
        </p>
      ) : null}
      {hint.text ? <p>{hint.text}</p> : null}
      {!hint.text && !hint.figure && (!hint.image || imgFailed) ? <p className="muted">No further hint content.</p> : null}
    </div>
  );
}

function RevealDetails({ r, review = false }: { r: RoundResolved; review?: boolean }) {
  return (
    <>
      {review && r.reveal.targetDisplay ? (
        <p><strong>{r.reveal.benchmarkLabel ?? "Target"}:</strong> {r.reveal.targetDisplay} {r.reveal.unit}</p>
      ) : null}
      {r.entity ? (
        <p>You picked <strong>{r.entity.label}</strong> ({r.entity.valueDisplay} {r.reveal.unit}).</p>
      ) : r.guess ? (
        <p>You guessed <strong>{r.guess.display} {r.reveal.unit}</strong>.</p>
      ) : null}
      {r.closest && r.closest.entries.length > 0 ? (
        <p>
          Closest {r.closest.entries.length > 1 || r.closest.moreCount > 0 ? "matches" : "match"}:{ " " }
          {r.closest.entries.map((c, i) => (
            <span key={c.label}>
              {i > 0 ? ", " : ""}<strong>{c.label}</strong> ({c.valueDisplay} {r.reveal.unit})
            </span>
          ))}
          {r.closest.moreCount > 0 ? ` and ${r.closest.moreCount} equally close.` : "."}
        </p>
      ) : null}
      <div className="reveal-box">
        <p>{r.reveal.explanation}</p>
        {r.reveal.steps?.length ? <ol>{r.reveal.steps.map((s, i) => <li key={i}>{s}</li>)}</ol> : null}
        {r.reveal.comparison ? <p className="muted">{r.reveal.comparison}</p> : null}
        {r.reveal.source ? (
          <p className="muted small">
            Source: {r.reveal.source.url ? <a href={r.reveal.source.url} target="_blank" rel="noreferrer">{r.reveal.source.title}</a> : r.reveal.source.title}
          </p>
        ) : null}
      </div>
      {r.percentile != null ? (
        <p className="muted small">Closer than {r.percentile}% of players who guessed.</p>
      ) : null}
    </>
  );
}

function RecapView({
  state,
  shareUrl,
  setShareUrl,
  comparison,
  setComparison,
  onShare,
  notice,
  sharing,
}: {
  state: AttemptState;
  shareUrl: string | null;
  setShareUrl: (v: string | null) => void;
  comparison: boolean;
  setComparison: (v: boolean) => void;
  onShare: (c: boolean) => void;
  notice: string | null;
  sharing: boolean;
}) {
  const recap = state.recap!;
  const [resetIn, setResetIn] = useState("");
  const [reportFor, setReportFor] = useState<number | null>(null);
  const [copyState, setCopyState] = useState<"idle" | "copied" | "manual">("idle");
  const heading = useRef<HTMLHeadingElement>(null);
  const daily = recap.mode === "daily";
  const newBest = daily && recap.previousBest != null && recap.total > recap.previousBest;
  const great = recap.total >= 350;

  useEffect(() => heading.current?.focus({ preventScroll: true }), []);

  useEffect(() => {
    if (!daily) return;
    const tick = () => {
      const diff = new Date(recap.nextResetIso).getTime() - Date.now();
      if (diff <= 0) {
        setResetIn("now");
        return;
      }
      const minutes = Math.ceil(diff / 60_000);
      setResetIn(`${Math.floor(minutes / 60)}h ${minutes % 60}m`);
    };
    tick();
    const id = setInterval(tick, 10_000);
    return () => clearInterval(id);
  }, [daily, recap.nextResetIso]);

  async function copyMarks() {
    try {
      await navigator.clipboard.writeText(shareText(recap));
      setCopyState("copied");
    } catch {
      setCopyState("manual");
    }
  }

  return (
    <main className="play-shell">
      <div className="game-heading">
        <div>
          <p className="eyebrow">{daily ? "Daily" : "Archive"} #{recap.displayNumber} · {recap.puzzleDate}</p>
          <h1 ref={heading} tabIndex={-1}>Puzzle complete</h1>
        </div>
        {daily && resetIn !== "now"
          ? <span className="muted">Next daily in {resetIn || "…"}</span>
          : daily
            ? <button onClick={() => window.location.reload()}>New daily puzzle →</button>
            : <Link href="/estimation">Today’s puzzle →</Link>}
      </div>

      <section className="card result-hero">
        {great || newBest ? <PixelConfetti count={64} duration={2} /> : null}
        <div className="recap-scoreboard">
          <div className="recap-dial"><ScoreRing total={recap.total} max={recap.maxTotal} size={128} /></div>
          <div>
            <PixelSprite sprite={great ? OWL.star : OWL.happy} palette={OWL_PALETTE} size={48} />
            <h2>{newBest ? "New personal best" : great ? "Sharp estimates" : "Good to get a reading"}</h2>
            {recap.streak && recap.streak.current > 0 ? (
              <p className="muted">{recap.streak.current}-day streak</p>
            ) : <p className="muted">Five rounds scored.</p>}
          </div>
        </div>
        <ol className="recap-marks" aria-label="Round scores">
          {recap.rounds.map((r) => (
            <li key={r.ordinal}>
              <a className={markClass(r.mark)} href={`#review-${r.ordinal}`} onClick={() => {
                const review = document.getElementById(`review-${r.ordinal}`);
                if (review instanceof HTMLDetailsElement) review.open = true;
              }}>
                <strong>{r.points}</strong><span>{r.mark}</span>
              </a>
            </li>
          ))}
        </ol>
        <div className="actions recap-actions">
          <button className="primary" onClick={copyMarks}>{copyState === "copied" ? "Marks copied" : "Copy spoiler-free marks"}</button>
          <Link className="btn" href="/estimation/scale-run">Play Scale Run</Link>
          <Link className="btn" href="/estimation/close-call">Play Close Call</Link>
          <Link className="btn" href="/estimation/lab">Open the Lab</Link>
          <Link className="btn" href="/estimation/warm-up">Play a warm-up</Link>
          <Link className="btn" href="/estimation/archive">Browse the archive</Link>
        </div>
        {copyState === "manual" ? (
          <textarea rows={2} aria-label="Spoiler-free result" readOnly value={shareText(recap)} onFocus={(e) => e.currentTarget.select()} />
        ) : null}
      </section>

      <details className="card scoring-explainer">
        <summary><strong>Share a result link</strong></summary>
        <p className="muted">Share your score and round marks without revealing any answers.</p>
        <label className="check-row">
          <input type="checkbox" checked={comparison} disabled={sharing} onChange={(e) => {
            setComparison(e.target.checked);
            setShareUrl(null);
          }} />
          <span>Let friends who finished the same puzzle compare scores by round</span>
        </label>
        <div className="actions">
          <button onClick={() => onShare(comparison)} disabled={sharing}>{sharing ? "Creating link…" : "Create share link"}</button>
        </div>
        {shareUrl ? (
          <div className="share-link">
            <label htmlFor="result-link">Result link</label>
            <input id="result-link" type="text" value={shareUrl} readOnly onFocus={(e) => e.currentTarget.select()} />
          </div>
        ) : null}
        {notice ? <p role="status" className="muted">{notice}</p> : null}
      </details>

      <section aria-labelledby="review-heading">
        <h2 id="review-heading">Answer review</h2>
        {recap.rounds.map((r) => (
          <details className="review" id={`review-${r.ordinal}`} key={r.ordinal}>
            <summary>
              <span className={markClass(r.mark)}>{markChip(r)}</span>
              <span className="q">{r.promptText}</span>
            </summary>
            <RevealDetails r={r} review />
            {reportFor === r.ordinal ? (
              <ReportForm revisionId={r.revisionId} onDone={() => setReportFor(null)} />
            ) : (
              <button className="quiet" onClick={() => setReportFor(r.ordinal)}>Report a problem with this question</button>
            )}
          </details>
        ))}
      </section>
      {SIBLING_GAMES.length > 0 ? (
        <p className="muted small">More daily games: {SIBLING_GAMES.map((g, i) => (
          <span key={g.url}>{i > 0 ? " · " : ""}<a href={g.url}>{g.name}</a></span>
        ))}</p>
      ) : null}
    </main>
  );
}

function ReportForm({ revisionId, onDone }: { revisionId: string; onDone: () => void }) {
  const [reason, setReason] = useState("");
  const [url, setUrl] = useState("");
  const [done, setDone] = useState(false);
  const [sending, setSending] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  return done ? (
    <p role="status" className="muted">Thanks — the report was sent to the editors.</p>
  ) : (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        setSending(true);
        const { data } = await api("/api/estimation/report", { revisionId, reason, url: url || undefined });
        setSending(false);
        if (data.ok) setDone(true);
        else setErr(String(data.message ?? "Report failed."));
      }}
    >
      <label htmlFor={`reason-${revisionId}`}>What&apos;s wrong?</label>
      <textarea id={`reason-${revisionId}`} value={reason} onChange={(e) => setReason(e.target.value)} maxLength={2000} rows={3} />
      <label htmlFor={`url-${revisionId}`}>Supporting link (optional)</label>
      <input id={`url-${revisionId}`} type="text" value={url} onChange={(e) => setUrl(e.target.value)} />
      {err ? <p role="alert" className="muted">{err}</p> : null}
      <div className="actions">
        <button type="submit" disabled={sending || reason.trim().length === 0}>{sending ? "Sending…" : "Send report"}</button>
        <button type="button" onClick={onDone}>Cancel</button>
      </div>
    </form>
  );
}
