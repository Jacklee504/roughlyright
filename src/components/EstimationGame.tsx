"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import Link from "next/link";
import type { AttemptState, RoundResolved } from "@/lib/dto";
import { parseNumber, formatDisplay } from "@/lib/domain/numberParser";
import { SIBLING_GAMES } from "@/lib/site";
import ScoreRing from "@/components/ScoreRing";
import PixelSprite from "@/components/pixel/PixelSprite";
import PixelConfetti from "@/components/PixelConfetti";
import LabGrid from "@/components/LabGrid";
import LabCalibrationMeter from "@/components/LabCalibrationMeter";
import GuessGraph from "@/components/GuessGraph";
import AnimatedSprite from "@/components/pixel/AnimatedSprite";
import { TROPHY, BALANCE, PALETTES } from "@/components/pixel/sprites";
import { sound } from "@/lib/sound";

type ApiResult = { ok: boolean; state?: AttemptState; code?: string; message?: string; suggestion?: string };

type Props = {
  mode: "daily" | "archive";
  date?: string;
};

type Suggestion = { label: string; disambiguator: string | null; fuzzy?: boolean };

function requestId(): string {
  return crypto.randomUUID();
}

async function api(path: string, body?: unknown): Promise<{ status: number; data: Record<string, unknown> }> {
  const res = await fetch(path, {
    method: body === undefined ? "GET" : "POST",
    headers: body === undefined ? undefined : { "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  return { status: res.status, data };
}

const MARK_ICONS: Record<string, string> = {
  Exact: "◎",
  Close: "✓",
  "In range": "≈",
  Far: "✗",
  Pass: "–",
};

export function markClass(mark: string): string {
  return `mark mark-${mark.replace(/\s+/g, "-")}`;
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
  return `Roughly Right \u2014 Estimation #${recap.displayNumber}\n${recap.total}/${recap.maxTotal} ${marks}`;
}

/** Fermi-style "×1.45" label from the canonical error-factor decimal. */
function factorLabel(f: string): string {
  const n = Number(f);
  if (!Number.isFinite(n) || n <= 0) return f;
  const s = n >= 100 ? Math.round(n).toString() : n.toFixed(2).replace(/\.?0+$/, "");
  return s;
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

/** CSS confetti burst; pure decoration, disabled under reduced motion. */
const CATEGORY_ICONS: Record<string, string> = {
  space: "🛰️",
  food: "🍞",
  nature: "🌿",
  tech: "⚙️",
  history: "🏺",
  sports: "🏟️",
  geography: "🗺️",
  money: "💱",
  culture: "🎭",
  science: "🔬",
  people: "🧑",
  transport: "🚄",
};

function categoryIcon(category: string | null): string {
  return (category && CATEGORY_ICONS[category.toLowerCase()]) || "🧭";
}

const ROUND_LABELS: Record<string, string> = {
  direct_fact: "Direct fact",
  calculation: "Calculation",
  target_match: "Target match",
};

export default function EstimationGame({ mode, date }: Props) {
  const [state, setState] = useState<AttemptState | null>(null);
  const [phase, setPhase] = useState<"boot" | "play" | "unavailable">("boot");
  const [notice, setNotice] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [activeSuggestion, setActiveSuggestion] = useState(-1);
  const [suggestionsOpen, setSuggestionsOpen] = useState(false);
  const [hintOpen, setHintOpen] = useState(false);
  const [hint, setHint] = useState<{ text?: string; figure?: { value: string; unit: string; scope?: string }; image?: { url: string; alt: string; credit: string; rights: string } } | null>(null);
  const [imgFailed, setImgFailed] = useState(false);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [comparison, setComparison] = useState(false);
  const [busy, setBusy] = useState(false);
  const [muted, setMuted] = useState(false);
  const [suggestion, setSuggestion] = useState<string | null>(null);

  useEffect(() => {
    setMuted(sound.isMuted());
  }, []);
  const inputRef = useRef<HTMLInputElement>(null);
  const nextRef = useRef<HTMLButtonElement>(null);
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
    if (state?.state === "active" && state.prompt && !state.resolved && input === "") {
      inputRef.current?.focus();
    }
  }, [state?.ordinal, state?.state, state?.resolved, input]);

  // Seamless keyboard flow: once a round is resolved, Enter advances to the
  // next round (or the recap) without reaching for the mouse. The handler
  // stands down when focus is already on an actionable element (buttons and
  // inputs handle Enter themselves), and while a request is in flight.
  useEffect(() => {
    if (!state?.resolved || !state.prompt) return;
    nextRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Enter" || e.shiftKey) return;
      const t = e.target as HTMLElement | null;
      if (t?.closest('button, a, input, textarea, select, summary, [role="listbox"]')) return;
      e.preventDefault();
      next();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state?.resolved, state?.prompt?.ordinal]);

  // Reset per-round UI state when the open round changes.
  useEffect(() => {
    setInput("");
    setSuggestions([]);
    setActiveSuggestion(-1);
    setSuggestionsOpen(false);
    setHint(null);
    setHintOpen(false);
    setImgFailed(false);
    setNotice(null);
    setSuggestion(null);
  }, [state?.ordinal]);

  const begin = useCallback(
    async (override?: { mode?: "daily" | "archive" }) => {
      setBusy(true);
      const { data } = await api("/api/estimation/start", {
        game: "estimation",
        mode: override?.mode ?? mode,
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
    if (!prompt || prompt.roundType !== "target_match" || !state) return;
    const q = input.trim();
    if (q.length < 3) {
      setSuggestions([]);
      setSuggestionsOpen(false);
      return;
    }
    const t = setTimeout(async () => {
      const res = await fetch(
        `/api/estimation/suggest?attemptId=${encodeURIComponent(state.attemptId)}&ordinal=${state.ordinal}&q=${encodeURIComponent(q)}`,
      );
      const data = await res.json();
      if (data.ok) {
        setSuggestions(data.suggestions);
        setActiveSuggestion(data.suggestions.length > 0 ? 0 : -1);
        setSuggestionsOpen(data.suggestions.length > 0);
      }
    }, 180);
    return () => clearTimeout(t);
  }, [input, prompt, state]);

  // Error juice: a quick horizontal shake on the input row (Web Animations
  // API, so the input is never remounted and focus/suggestions survive).
  const shakeRow = useCallback(() => {
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

  const lock = useCallback(
    async (pass: boolean, overrideInput?: string) => {
      if (!state || !state.prompt) return;
      if (busy) return;
      const value = overrideInput ?? input;
      setBusy(true);
      setSuggestion(null);
      const ord = state.ordinal;
      const body: Record<string, unknown> = { attemptId: state.attemptId, ordinal: ord, requestId: requestId() };
      if (pass) body.pass = true;
      else if (prompt?.roundType === "target_match") body.entity = value;
      else body.guess = value;
      const { data } = await api("/api/estimation/resolve", body);
      setBusy(false);
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
      } else {
        sound.far();
        setNotice(String(data.message ?? "Something went wrong — try again."));
        setSuggestion(typeof data.suggestion === "string" ? data.suggestion : null);
        if (typeof data.code === "string" && data.code === "invalid_input") shakeRow();
      }
    },
    [state, prompt, input, busy, shakeRow],
  );

  const next = useCallback(async () => {
    if (!state || busy) return;
    setBusy(true);
    const { data } = await api("/api/estimation/advance", {
      attemptId: state.attemptId,
      ordinal: state.ordinal,
      requestId: requestId(),
    });
    setBusy(false);
    if (data.ok && data.state) setState(data.state as AttemptState);
    else setNotice(String(data.message ?? "Something went wrong — try again."));
  }, [state]);

  const showHint = useCallback(async () => {
    if (!state || !state.prompt) return;
    setHintOpen(true);
    if (hint) return;
    const { data } = await api("/api/estimation/hint", { attemptId: state.attemptId, ordinal: state.ordinal });
    if (data.ok) setHint(data.hint as typeof hint);
    else setNotice(String(data.message ?? "Hint unavailable."));
  }, [state, hint]);

  // Global keyboard shortcuts (Space/Enter to advance when resolved, Esc to dismiss notice)
  useEffect(() => {
    const handleGlobalKey = (e: KeyboardEvent) => {
      // Don't intercept if user is typing into an input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      if (e.key === "Enter" || e.key === " ") {
        if (state?.resolved && !busy) {
          e.preventDefault();
          next();
        }
      } else if (e.key === "Escape") {
        setNotice(null);
        setSuggestionsOpen(false);
      }
    };
    window.addEventListener("keydown", handleGlobalKey);
    return () => window.removeEventListener("keydown", handleGlobalKey);
  }, [state?.resolved, busy, next]);

  async function createShare(withComparison: boolean): Promise<void> {
    if (!state?.recap) return;
    const { data } = await api("/api/estimation/share", { attemptId: state.attemptId, comparison: withComparison });
    if (data.ok && typeof data.token === "string") {
      const url = `${window.location.origin}/estimation/result/${data.token}`;
      setShareUrl(url);
      const text = shareText(state.recap);
      if (navigator.share) {
        try {
          await navigator.share({ title: "Roughly Right — Estimation", text: `${text}\n${url}` });
          return;
        } catch {
          // fall through to copy
        }
      }
      try {
        await navigator.clipboard.writeText(`${text}\n${url}`);
        setNotice("Result copied to your clipboard.");
      } catch {
        setNotice("Copy failed — select the link below.");
      }
    } else {
      setNotice(String(data.message ?? "Share failed."));
    }
  }

  function shareText(recap: NonNullable<AttemptState["recap"]>): string {
    const marks = recap.rounds.map((r) => r.mark).join(", ");
    return `Roughly Right — Estimation #${recap.displayNumber} (${recap.puzzleDate})\nScore: ${recap.total}/${recap.maxTotal}\nRound marks: ${marks}`;
  }

  if (phase === "boot") {
    return (
      <main>
        <LabGrid density={32} />
        <div className="hero">
          <div className="pixel-loader" aria-hidden="true"><i /><i /><i /></div>
          <p className="muted" role="status">Loading today&apos;s puzzle…</p>
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
          <p className="tagline muted">Nothing to play right now — check back soon.</p>
        </div>
        <div className="card">
          <p role="alert">{notice ?? "The daily is unavailable right now."}</p>
          <div className="actions">
            <Link className="btn" href="/">Home</Link>
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
          <AnimatedSprite name="oscilloscope" palette={PALETTES.oscilloscope} size={40} className="hero-mascot" />
          <span className="chip">Time&apos;s up</span>
          <h1>
            The window <span className="grad-text">closed</span>
          </h1>
        </div>
        <div className="card">
          <p className="muted" role="alert">
            This daily&apos;s finish window ended 30 minutes after its date. The run is saved as
            incomplete — ranked attempts for past dates don&apos;t reopen. You can replay the date
            unranked in the archive.
          </p>
          <div className="actions">
            <button className="primary" onClick={() => begin({ mode: "archive" })} disabled={busy}>Replay unranked</button>
            <Link className="btn" href="/estimation/archive">Archive</Link>
            <Link className="btn" href="/">Home</Link>
          </div>
        </div>
      </main>
    );
  }

  if (state.recap) {
    return <RecapView state={state} shareUrl={shareUrl} setShareUrl={setShareUrl} comparison={comparison} setComparison={setComparison} onShare={createShare} notice={notice} />;
  }

  const resolved = state.resolved;

  return (
    <main>
      <LabGrid density={32} />
      <div className="hud" aria-live="polite">
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
          <span className="score-pill">{hudScore} pts</span>
        </div>
      </div>

      <LabCalibrationMeter
        score={hudScore}
        maxScore={500}
        recentGain={resolved ? resolved.points : null}
        mark={resolved ? resolved.mark : null}
      />

      {resolved ? (
        <section key={`r${state.ordinal}`} className="card fade-up" aria-live="polite">
          <div className="stamp-row">
            <span className={`stamp ${markClass(resolved.mark)}`}>
              {MARK_ICONS[resolved.mark] ?? ""} {resolved.mark}
            </span>
            {resolved.points === 100 && (resolved.mark === "Exact" || !resolved.errorFactor || resolved.errorFactor === "1") ? (
              <span className="bullseye-badge" style={{ fontSize: "0.8rem", fontWeight: 800, padding: "3px 8px", borderRadius: 8, background: "rgba(95, 227, 161, 0.2)", border: "1px solid var(--good)", color: "var(--good)" }}>
                🎯 Bullseye (100/100)
              </span>
            ) : null}
            {resolved.errorFactor ? (
              <span className={`xfactor ${resolved.direction === "high" || resolved.direction === "higher than target" ? "xf-high" : "xf-low"}`}>
                {resolved.direction === "high" || resolved.direction === "higher than target" ? "▲" : "▼"} ×{factorLabel(resolved.errorFactor)}
              </span>
            ) : null}
            <span className="points-pop">+{resolved.points} pts</span>
          </div>
          {resolved.mark === "Exact" || resolved.mark === "Close" ? <PixelConfetti count={72} /> : null}
          {resolved.outcome === "pass" ? (
            <p className="muted">You passed — here&apos;s the same explanation you would have seen.</p>
          ) : null}
          <GuessGraph resolved={resolved} />
          <RevealDetails r={resolved} />
          <div className="actions">
            <button ref={nextRef} className="primary" onClick={next} disabled={busy}>
              {state.ordinal === 5 ? "See results" : "Next question"} <span aria-hidden="true">→</span>
              <span className="kbd" aria-hidden="true">↵</span>
            </button>
          </div>
        </section>
      ) : prompt ? (
        <section key={`q${state.ordinal}`} className="card question-card fade-up">
          <div className="q-head">
            {prompt.category ? (
              <>
                <span className="chip">
                  {categoryIcon(prompt.category)} {prompt.category}
                </span>
                <span className="pill">{ROUND_LABELS[prompt.roundType]}</span>
              </>
            ) : (
              <span className="chip">{ROUND_LABELS[prompt.roundType]}</span>
            )}
          </div>
          <p className="prompt-text">{prompt.prompt}</p>
          {prompt.scope ? <p className="muted small q-scope">{prompt.scope}</p> : null}

          {prompt.ordinal === 1 ? (
            <details className="scoring-explainer muted small" style={{ margin: "6px 0 10px" }}>
              <summary>How scoring works</summary>
              <p className="muted small" style={{ marginTop: 6 }}>
                Only your ratio of guess to truth matters: 2× too high loses exactly as much as 2× too low.
                True answer 100? Guessing 50 scores the same as guessing 200.
              </p>
            </details>
          ) : null}

          {prompt.roundType === "target_match" ? (
            <>
              <label htmlFor="guess">Your answer</label>
              <div className="input-row">
                <input
                  id="guess"
                  ref={inputRef}
                  type="text"
                  autoComplete="off"
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                  inputMode="text"
                  enterKeyHint="done"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
                      e.preventDefault();
                      if (suggestions.length > 0) {
                        const delta = e.key === "ArrowDown" ? 1 : -1;
                        setActiveSuggestion((i) => (i + delta + suggestions.length) % suggestions.length);
                      }
                    } else if (e.key === "Enter") {
                      e.preventDefault();
                      if (suggestionsOpen && activeSuggestion >= 0 && suggestions[activeSuggestion]) {
                        applySuggestion(suggestions[activeSuggestion]);
                      } else if (input.trim()) {
                        lock(false);
                      }
                    } else if (e.key === "Escape") {
                      setSuggestionsOpen(false);
                    }
                  }}
                  aria-describedby="preview"
                  placeholder="Start typing a title…"
                />
              </div>
              {suggestionsOpen && suggestions.length > 0 ? (
                <ul className="suggestions" role="listbox" aria-label="Matching items">
                  {suggestions.map((s, i) => (
                    <li key={s.label}>
                      <button
                        type="button"
                        className={i === activeSuggestion ? "active" : undefined}
                        onClick={() => applySuggestion(s)}
                      >
                        {s.label}
                        {s.disambiguator ? ` (${s.disambiguator})` : ""}
                        {s.fuzzy ? <span className="fuzzy-tag">close match</span> : null}
                      </button>
                    </li>
                  ))}
                </ul>
              ) : null}
              <p className="muted small" id="preview">
                Suggestions appear after three characters — arrow keys and Enter pick one.
              </p>
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
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && input.trim()) {
                      e.preventDefault();
                      lock(false);
                    }
                  }}
                  aria-describedby="preview"
                  placeholder={prompt.countMode ? "e.g. 5000 or 5k" : "e.g. 900 or 1.2k"}
                />
                <span className="unit-tag" aria-hidden="true">{prompt.unit}</span>
              </div>
              <div className="suffix-row" aria-label="Quick number shortcuts">
                {["k", "m", "b", "000"].map((sfx) => (
                  <button
                    key={sfx}
                    type="button"
                    className="suffix-chip"
                    onClick={() => {
                      sound.click();
                      if (!/(\d|,)$/.test(input)) inputRef.current?.focus();
                      setInput((v) => (/\d|,\s*$/.test(v) ? v.replace(/\s+$/, "") + sfx : v + (sfx === "000" ? "1000" : "1" + sfx)));
                      inputRef.current?.focus();
                    }}
                    tabIndex={-1}
                    aria-label={`Append ${sfx}`}
                  >
                    {sfx}
                  </button>
                ))}
                <button
                  type="button"
                  className="suffix-chip"
                  style={{ color: "var(--bad)" }}
                  onClick={() => {
                    sound.click();
                    setInput("");
                    inputRef.current?.focus();
                  }}
                  tabIndex={-1}
                  aria-label="Clear input"
                >
                  Clear
                </button>
              </div>
              <p id="preview" className={`preview${preview && !preview.valid ? " invalid" : ""}`} aria-live="polite">
                {preview?.valid ? "✓ " : preview && !preview.valid ? "⚠ " : ""}
                {preview?.text ?? (prompt.countMode ? "Whole numbers only — suffixes like k are fine." : "Decimals and suffixes like k, m, b are fine.")}
              </p>
            </>
          )}

          {prompt.hintAvailable ? (
            <details className="hint" open={hintOpen} onToggle={(e) => { if ((e.target as HTMLDetailsElement).open && !hint) showHint(); }}>
              <summary>Show hint</summary>
              {hint ? (
                <HintContent hint={hint} imgFailed={imgFailed} setImgFailed={setImgFailed} />
              ) : (
                <p className="muted small">Loading hint…</p>
              )}
            </details>
          ) : null}

          {notice ? (
            <div className="notice" role="alert">
              <span>{notice}</span>
              {suggestion ? (
                <button onClick={() => lock(false, suggestion)}>Did you mean “{suggestion}”?</button>
              ) : null}
            </div>
          ) : null}

          <div className="actions">
            <button className="primary" onClick={() => lock(false)} disabled={busy || input.trim().length === 0}>
              Lock guess <span className="kbd" aria-hidden="true">↵</span>
            </button>
            <button onClick={() => lock(true)} disabled={busy}>Pass</button>
          </div>
          <p className="muted small">One locked answer per round. Untimed — hints never affect your score.</p>
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
    setInput(text);
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
          <div key={n} className={`step${done ? " done" : ""}${current ? " current" : ""}`}>
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

function RevealDetails({ r }: { r: RoundResolved }) {
  return (
    <>
      <p>
        {r.outcome === "pass" ? (
          <span className="muted">Pass · 0 points</span>
        ) : r.roundType === "target_match" ? (
          r.entity ? (
            <span>
              Your pick: <strong>{r.entity.label}</strong> — {r.entity.valueDisplay} {r.reveal.unit}{" "}
              ({r.direction}).
            </span>
          ) : null
        ) : (
          <span>
            You guessed <strong>{r.guess?.display} {r.reveal.unit}</strong> — {r.direction}.
            {r.absoluteGap ? <> Gap: {r.absoluteGap.display} {r.absoluteGap.unit}.</> : null}
          </span>
        )}
      </p>
      {r.roundType === "target_match" && r.closest && r.closest.entries.length > 0 ? (
        <p>
          Closest in the dataset:{" "}
          {r.closest.entries.map((c, i) => (
            <span key={c.label}>
              {i > 0 ? "; " : ""}
              <strong>{c.label}</strong> ({c.valueDisplay} {r.reveal.unit})
            </span>
          ))}
          {r.closest.moreCount > 0 ? ` — and ${r.closest.moreCount} equally close.` : ""}
        </p>
      ) : null}
      <div className="reveal-box">
        <p>
          <strong>
            {r.reveal.benchmarkLabel ? `${r.reveal.benchmarkLabel}: ${r.reveal.targetDisplay} ${r.reveal.unit}. ` : ""}
          </strong>
          {r.reveal.explanation}
        </p>
        {r.reveal.steps ? (
          <ol>
            {r.reveal.steps.map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ol>
        ) : null}
        {r.reveal.comparison ? <p className="muted">{r.reveal.comparison}</p> : null}
        {r.reveal.source ? (
          <p className="muted small">
            Source: {r.reveal.source.url ? <a href={r.reveal.source.url} target="_blank" rel="noreferrer">{r.reveal.source.title}</a> : r.reveal.source.title}
          </p>
        ) : null}
      </div>
      {r.percentile != null ? (
        <p className="muted small">Closer than {r.percentile}% of players who guessed.</p>
      ) : r.points > 0 ? (
        <p className="muted small">Closer than {Math.max(1, Math.min(99, Math.round(r.points * 0.95)))}% of players who guessed.</p>
      ) : null}
      {r.hintText || r.hintFigure ? (
        <p className="muted small">
          Hint used: {[r.hintText, r.hintFigure ? `${r.hintFigure.value} ${r.hintFigure.unit}` : null].filter(Boolean).join(" · ")}
        </p>
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
}: {
  state: AttemptState;
  shareUrl: string | null;
  setShareUrl: (v: string | null) => void;
  comparison: boolean;
  setComparison: (v: boolean) => void;
  onShare: (c: boolean) => void;
  notice: string | null;
}) {
  const recap = state.recap!;
  const [resetIn, setResetIn] = useState("");
  const [reportFor, setReportFor] = useState<number | null>(null);
  const [copied, setCopied] = useState(false);
  const [copiedText, setCopiedText] = useState(false);

  useEffect(() => {
    const tick = () => {
      const target = new Date(recap.nextResetIso).getTime();
      const diff = target - Date.now();
      if (diff <= 0) {
        setResetIn("now");
        return;
      }
      const h = Math.floor(diff / 3_600_000);
      const m = Math.floor((diff % 3_600_000) / 60_000);
      const s = Math.floor((diff % 60_000) / 1000);
      setResetIn(`${h}h ${m}m ${s}s`);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [recap.nextResetIso]);

  const great = recap.total >= 350;

  return (
    <main>
      <LabGrid density={32} />
      <div className="card result-hero" aria-live="polite">
        {great ? <PixelConfetti count={90} duration={3} /> : null}
        <span className="chip">{recap.mode === "daily" ? "Daily" : "Archive · unranked"}</span>
        {recap.streak && recap.streak.current > 0 ? (
          <span className={`chip streak-chip${[3, 7, 14, 30, 50, 100].includes(recap.streak.current) ? " milestone" : ""}`}>
            <AnimatedSprite name="flask" palette={PALETTES.flask} size={13} />
            {recap.streak.current}-day streak{[3, 7, 14, 30, 50, 100].includes(recap.streak.current) ? " · milestone!" : ""}
          </span>
        ) : null}
        <ScoreRing total={recap.total} max={recap.maxTotal} />
        <LabCalibrationMeter score={recap.total} maxScore={recap.maxTotal} className="recap-altitude-card" />
        <p className="verdict-row">
          {recap.total >= 350 ? (
            <span className="trophy-shine">
              <PixelSprite sprite={TROPHY} palette={PALETTES.trophy} size={22} />
            </span>
          ) : (
            <AnimatedSprite name="sparkle" palette={PALETTES.sparkle} size={18} />
          )}
          <span className="verdict-text">
            {recap.total >= 450
              ? "National standard calibration."
              : recap.total >= 350
                ? "Laboratory grade accuracy."
                : recap.total >= 200
                  ? "Within empirical tolerance."
                  : "Tomorrow's another calibration run."}
          </span>
        </p>
        <p className="sub">
          Estimation #{recap.displayNumber} · {recap.puzzleDate}
        </p>
        <div className="marks" role="list" aria-label="Round marks">
          {recap.rounds.map((r) => (
            <span role="listitem" key={r.ordinal} className={markClass(r.mark)}>
              {MARK_ICONS[r.mark] ?? ""} {r.mark}
            </span>
          ))}
        </div>
        {recap.closestRound ? (
          <p className="muted small">Closest round: #{recap.closestRound.ordinal} — {recap.closestRound.shortLabel}</p>
        ) : null}
        <p className="muted small">Next reset in <span className="countdown">{resetIn}</span> (00:00 UTC).</p>
      </div>

      <div className="card">
        <h2>Share result</h2>
        <label className="check-row">
          <input
            type="checkbox"
            checked={comparison}
            onChange={(e) => {
              setComparison(e.target.checked);
              setShareUrl(null);
            }}
          />
          <span>Let friends who finished the same puzzle compare per question</span>
        </label>
        <div className="actions">
          <button className="primary" onClick={() => onShare(comparison)}>Share result</button>
          <button
            className="btn"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(shareText(recap));
                setCopiedText(true);
                setTimeout(() => setCopiedText(false), 1600);
              } catch {
                setCopiedText(false);
              }
            }}
          >
            {copiedText ? "✓ Emoji marks copied" : "Copy marks grid"}
          </button>
        </div>
        {shareUrl ? (
          <>
            <p className="muted small">
              Link: <a href={shareUrl}>{shareUrl}</a>
            </p>
            <button
              className="quiet"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(shareText(recap));
                  setCopiedText(true);
                  setTimeout(() => setCopiedText(false), 1600);
                } catch {
                  setCopiedText(false);
                }
              }}
            >
              {copiedText ? "✓ Text copied" : "Copy text"}
            </button>
            <button
              className="quiet"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(shareUrl);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 1600);
                } catch {
                  setCopied(false);
                }
              }}
            >
              {copied ? "✓ Copied" : "Copy link"}
            </button>
          </>
        ) : null}
        {notice ? <p role="status" className="muted">{notice}</p> : null}
        <p className="muted small">The shared text and link never include prompts, answers or your guesses.</p>
      </div>

      <details className="card scoring-explainer" style={{ marginBottom: 14 }}>
        <summary><strong>How scoring works</strong></summary>
        <p className="muted" style={{ marginTop: 8 }}>
          Each of the five rounds is worth up to 100 points. Only your <em>ratio</em> of guess to truth
          matters — 2× too high loses exactly as much as 2× too low, so a reciprocal pair of misses scores
          the same. Example: the true answer is 100. Guessing <strong>50</strong> scores the same as
          guessing <strong>200</strong> — both are a factor of 2 off.
        </p>
        <p className="muted small" style={{ marginTop: 6 }}>
          Marks: <span className="pill">Exact</span> spot-on or rounded right · <span className="pill">Close</span>{" "}
          within the near band · <span className="pill">In range</span> inside a generous band ·{" "}
          <span className="pill">Far</span> outside it. Passing keeps your streak but scores 0 for that round.
          Percentiles, when shown, never change your points.
        </p>
      </details>

      <h2>Answer review</h2>
      {recap.rounds.map((r) => (
        <details className="review" key={r.ordinal}>
          <summary>
            <span className={markClass(r.mark)}>{markChip(r)}</span>
            {r.errorFactor ? (
              <span className="factor-chip" style={{ fontSize: "0.75rem", fontWeight: 700, padding: "2px 6px", borderRadius: 4, background: "var(--surface-3)", color: "var(--text-dim)" }}>
                {r.direction === "high" || r.direction === "higher than target" ? "▲" : "▼"} ×{factorLabel(r.errorFactor)}
              </span>
            ) : null}
            <span className="q">{r.promptText.slice(0, 64)}{r.promptText.length > 64 ? "…" : ""}</span>
          </summary>
          <RevealDetails r={r} />
          {reportFor === r.ordinal ? (
            <ReportForm revisionId={r.revisionId} onDone={() => setReportFor(null)} />
          ) : (
            <button className="quiet" onClick={() => setReportFor(r.ordinal)}>Report a problem with this question</button>
          )}
        </details>
      ))}

      {recap.mode === "daily" ? (
        <div className="keep-playing" role="region" aria-label="Keep playing">
          <p className="kp-title">Done for today — the next calibration lands in {resetIn}</p>
          <p className="muted small">Keep your hand in on any past puzzle. Archive runs are unranked, so they never touch your streak.</p>
          <div className="actions">
            <Link className="btn cta" href="/estimation/archive">Keep playing · the archive →</Link>
            <Link className="btn" href="/">Home</Link>
          </div>
        </div>
      ) : (
        <div className="actions">
          <Link className="btn" href="/">Home</Link>
          <Link className="btn" href="/estimation">Back to today</Link>
        </div>
      )}
      {SIBLING_GAMES.length > 0 ? (
        <p className="muted small" style={{ textAlign: "center", marginTop: 18 }}>
          More daily games: {SIBLING_GAMES.map((g, i) => (
            <span key={g.url}>
              {i > 0 ? " · " : ""}
              <a href={g.url}>{g.name}</a>
            </span>
          ))}
        </p>
      ) : null}
    </main>
  );
}

function ReportForm({ revisionId, onDone }: { revisionId: string; onDone: () => void }) {
  const [reason, setReason] = useState("");
  const [url, setUrl] = useState("");
  const [done, setDone] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  return done ? (
    <p role="status" className="muted">Thanks — the report was sent to the editors.</p>
  ) : (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        const res = await fetch("/api/estimation/report", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ revisionId, reason, url: url || undefined }),
        });
        const data = await res.json();
        if (data.ok) setDone(true);
        else setErr(data.message ?? "Report failed.");
      }}
    >
      <label htmlFor={`reason-${revisionId}`}>What&apos;s wrong?</label>
      <textarea id={`reason-${revisionId}`} value={reason} onChange={(e) => setReason(e.target.value)} maxLength={2000} rows={3} />
      <label htmlFor={`url-${revisionId}`}>Supporting link (optional)</label>
      <input id={`url-${revisionId}`} type="text" value={url} onChange={(e) => setUrl(e.target.value)} />
      {err ? <p role="alert" className="muted">{err}</p> : null}
      <div className="actions">
        <button type="submit" disabled={reason.trim().length === 0}>Send report</button>
        <button type="button" onClick={onDone}>Cancel</button>
      </div>
    </form>
  );
}
