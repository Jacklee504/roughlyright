"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import type { AttemptState, GameStatus, RoundResolved } from "@/lib/dto";
import { parseNumber, formatDisplay } from "@/lib/domain/numberParser";

type ApiResult = { ok: boolean; state?: AttemptState; code?: string; message?: string };

type Props = {
  mode: "daily" | "archive";
  date?: string;
};

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

function markClass(mark: string): string {
  return `mark mark-${mark.replace(/\s+/g, "-")}`;
}

function chipFor(r: { points: number; mark: string }): string {
  return `${r.points} pts · ${r.mark}`;
}

export default function EstimationGame({ mode, date }: Props) {
  const [status, setStatus] = useState<GameStatus | null>(null);
  const [state, setState] = useState<AttemptState | null>(null);
  const [phase, setPhase] = useState<"boot" | "intro" | "play" | "unavailable">("boot");
  const [notice, setNotice] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [suggestions, setSuggestions] = useState<{ label: string; disambiguator: string | null }[]>([]);
  const [hintOpen, setHintOpen] = useState(false);
  const [hint, setHint] = useState<{ text?: string; figure?: { value: string; unit: string; scope?: string }; image?: { url: string; alt: string; credit: string; rights: string } } | null>(null);
  const [imgFailed, setImgFailed] = useState(false);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [comparison, setComparison] = useState(false);
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (mode === "daily") {
      api("/api/estimation/status").then(({ data }) => {
        if (data.ok) {
          setStatus(data.status as GameStatus);
          setPhase("intro");
        } else {
          setPhase("unavailable");
        }
      });
    } else {
      setPhase("intro");
    }
  }, [mode]);

  useEffect(() => {
    if (state?.state === "active" && state.prompt && !state.resolved && input === "") {
      inputRef.current?.focus();
    }
  }, [state?.ordinal, state?.state, state?.resolved, input]);

  // Reset per-round UI state when the open round changes.
  useEffect(() => {
    setInput("");
    setSuggestions([]);
    setHint(null);
    setHintOpen(false);
    setImgFailed(false);
    setNotice(null);
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
      return;
    }
    const t = setTimeout(async () => {
      const res = await fetch(
        `/api/estimation/suggest?attemptId=${encodeURIComponent(state.attemptId)}&ordinal=${state.ordinal}&q=${encodeURIComponent(q)}`,
      );
      const data = await res.json();
      if (data.ok) setSuggestions(data.suggestions);
    }, 180);
    return () => clearTimeout(t);
  }, [input, prompt, state]);

  const lock = useCallback(
    async (pass: boolean) => {
      if (!state || !state.prompt) return;
      setBusy(true);
      const ord = state.ordinal;
      const body: Record<string, unknown> = { attemptId: state.attemptId, ordinal: ord, requestId: requestId() };
      if (pass) body.pass = true;
      else if (prompt?.roundType === "target_match") body.entity = input;
      else body.guess = input;
      const { data } = await api("/api/estimation/resolve", body);
      setBusy(false);
      if (data.ok && data.state) {
        setState(data.state as AttemptState);
      } else {
        setNotice(String(data.message ?? "Something went wrong — try again."));
      }
    },
    [state, prompt, input],
  );

  const next = useCallback(async () => {
    if (!state) return;
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

  const reloadState = useCallback(async () => {
    if (!state) return;
    const { data } = await api("/api/estimation/state", { attemptId: state.attemptId });
    if (data.ok && data.state) setState(data.state as AttemptState);
  }, [state]);

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
        <p className="muted" role="status">Loading…</p>
      </main>
    );
  }

  if (phase === "intro") {
    const a = status?.attempt;
    return (
      <main>
        <span className="chip">{mode === "daily" ? "Daily" : "Archive · unranked"}</span>
        <h1>Estimation</h1>
        {mode === "daily" && status?.puzzleNumber ? (
          <p className="muted">Puzzle #{status.puzzleNumber}{status.themeTag ? ` · ${status.themeTag}` : ""}</p>
        ) : null}
        {mode === "archive" && date ? <p className="muted">Date: {date}</p> : null}
        <p>
          Five estimates, one guess each. Closer answers earn more points, out of 500. Untimed —
          take the time you need.
        </p>
        {mode === "daily" && status ? (
          <p className="muted small">
            Streak: {status.streak.current} current · {status.streak.best} best
          </p>
        ) : null}
        {a?.state === "expired" ? (
          <p role="status" className="muted">
            A previous run ran out of its finish window and was saved as incomplete. Today's fresh
            daily is ready.
          </p>
        ) : null}
        <div className="actions">
          {mode === "daily" && a?.state === "completed" ? (
            <button className="primary" onClick={() => begin()} disabled={busy}>View results</button>
          ) : (
            <button className="primary" onClick={() => begin()} disabled={busy}>
              {a?.state === "active" ? "Continue" : mode === "daily" ? "Start today's Estimation" : "Play this date"}
            </button>
          )}
          <Link className="btn" href="/estimation/archive">Archive</Link>
        </div>
        {notice ? <p role="alert" className="muted">{notice}</p> : null}
      </main>
    );
  }

  if (phase === "unavailable") {
    return (
      <main>
        <h1>Estimation</h1>
        <p role="alert">{notice ?? "The daily is unavailable right now."}</p>
        <div className="actions">
          <Link className="btn" href="/">Home</Link>
          <Link className="btn" href="/estimation/archive">Archive</Link>
        </div>
      </main>
    );
  }

  if (!state) return null;

  if (state.state === "expired") {
    return (
      <main>
        <h1>Time ran out</h1>
        <p role="alert" className="muted">
          This daily's finish window ended 30 minutes after its date. The run is saved as
          incomplete — ranked attempts for past dates don't reopen. You can replay the date
          unranked in the archive.
        </p>
        <div className="actions">
          <button className="primary" onClick={() => begin({ mode: "archive" })} disabled={busy}>Replay unranked</button>
          <Link className="btn" href="/estimation/archive">Archive</Link>
          <Link className="btn" href="/">Home</Link>
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
      <div className="scorebar" aria-live="polite">
        <strong>Round {state.ordinal} of 5</strong>
        <span>Score: {state.score}</span>
        {state.mode === "daily" ? <span className="muted">#{state.displayNumber}</span> : <span className="muted">Archive · {state.puzzleDate}</span>}
      </div>

      {resolved ? (
        <section className="card" aria-live="polite">
          <span className={markClass(resolved.mark)}>{chipFor(resolved)}</span>
          {resolved.outcome === "pass" ? (
            <p className="muted">You passed — here's the same explanation you would have seen.</p>
          ) : null}
          <RevealDetails r={resolved} />
          <div className="actions">
            <button className="primary" onClick={next} disabled={busy}>
              {state.ordinal === 5 ? "See results" : "Next question"}
            </button>
          </div>
        </section>
      ) : prompt ? (
        <section className="card">
          <span className="chip">{prompt.category}</span>
          <h2 className="small">{prompt.roundType === "target_match" ? "Target match" : prompt.roundType === "calculation" ? "Calculation estimate" : "Direct fact"}</h2>
          <p>{prompt.prompt}</p>
          {prompt.scope ? <p className="muted small">{prompt.scope}</p> : null}

          {prompt.roundType === "target_match" ? (
            <>
              <label htmlFor="guess">Your answer</label>
              <div className="input-row">
                <input
                  id="guess"
                  ref={inputRef}
                  type="text"
                  autoComplete="off"
                  inputMode="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  aria-describedby="preview"
                  placeholder="Start typing a title…"
                />
              </div>
              {suggestions.length > 0 ? (
                <ul className="suggestions">
                  {suggestions.map((s) => (
                    <li key={s.label}>
                      <button
                        type="button"
                        onClick={() => {
                          setInput(s.disambiguator ? `${s.label} (${s.disambiguator})` : s.label);
                          setSuggestions([]);
                          inputRef.current?.focus();
                        }}
                      >
                        {s.label}{s.disambiguator ? ` (${s.disambiguator})` : ""}
                      </button>
                    </li>
                  ))}
                </ul>
              ) : null}
              <p className="muted small">Suggestions appear after three characters. Pick one or type the exact title.</p>
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
                  inputMode="decimal"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  aria-describedby="preview"
                  placeholder={prompt.countMode ? "e.g. 5000 or 5k" : "e.g. 900 or 1.2k"}
                />
                <span className="unit-tag" aria-hidden="true">{prompt.unit}</span>
              </div>
              <p id="preview" className={`preview${preview && !preview.valid ? " invalid" : ""}`} aria-live="polite">
                {preview?.text ?? (prompt.countMode ? "Whole numbers only — suffixes like k are fine." : "Decimals and suffixes like k, m, b are fine.")}
              </p>
            </>
          )}

          {prompt.hintAvailable ? (
            <details open={hintOpen} onToggle={(e) => { if ((e.target as HTMLDetailsElement).open && !hint) showHint(); }}>
              <summary>Show hint</summary>
              {hint ? (
                <HintContent hint={hint} imgFailed={imgFailed} setImgFailed={setImgFailed} />
              ) : (
                <p className="muted small">Loading hint…</p>
              )}
            </details>
          ) : null}

          {notice ? <p role="alert" className="muted">{notice}</p> : null}

          <div className="actions">
            <button className="primary" onClick={() => lock(false)} disabled={busy || input.trim().length === 0}>Lock guess</button>
            <button onClick={() => lock(true)} disabled={busy}>Pass</button>
          </div>
          <p className="muted small">One locked answer per round. Untimed — hints never affect your score.</p>
        </section>
      ) : (
        <section className="card">
          <p role="status">Loading…</p>
          <button onClick={reloadState}>Reload state</button>
        </section>
      )}
    </main>
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
      {imgFailed ? <p className="hint-fallback">The hint image couldn't load — the text below keeps this round usable.</p> : null}
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

  return (
    <main>
      <div className="card result-hero" aria-live="polite">
        <span className="chip">{recap.mode === "daily" ? "Daily" : "Archive · unranked"}</span>
        <h1>
          {recap.total}
          <span className="muted"> / {recap.maxTotal}</span>
        </h1>
        <p className="muted">
          Estimation #{recap.displayNumber} · {recap.puzzleDate}
        </p>
        <div className="marks" role="list" aria-label="Round marks">
          {recap.rounds.map((r) => (
            <span role="listitem" key={r.ordinal} className={markClass(r.mark)}>
              R{r.ordinal}: {r.mark}
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
        <label>
          <input
            type="checkbox"
            checked={comparison}
            onChange={(e) => {
              setComparison(e.target.checked);
              setShareUrl(null);
            }}
          />{" "}
          Let friends who finished the same puzzle compare per question
        </label>
        <div className="actions">
          <button className="primary" onClick={() => onShare(comparison)}>Share result</button>
        </div>
        {shareUrl ? (
          <p className="muted small">
            Link: <a href={shareUrl}>{shareUrl}</a>
          </p>
        ) : null}
        {notice ? <p role="status" className="muted">{notice}</p> : null}
        <p className="muted small">The shared text and link never include prompts, answers or your guesses.</p>
      </div>

      <h2>Answer review</h2>
      {recap.rounds.map((r) => (
        <details className="review" key={r.ordinal}>
          <summary>
            Round {r.ordinal}: <span className={markClass(r.mark)}>{chipFor(r)}</span> · {r.promptText.slice(0, 64)}{r.promptText.length > 64 ? "…" : ""}
          </summary>
          <RevealDetails r={r} />
          {reportFor === r.ordinal ? (
            <ReportForm revisionId={r.revisionId} onDone={() => setReportFor(null)} />
          ) : (
            <button className="quiet" onClick={() => setReportFor(r.ordinal)}>Report a problem with this question</button>
          )}
        </details>
      ))}

      <div className="actions">
        <Link className="btn" href="/">Home</Link>
        <Link className="btn" href="/estimation/archive">Archive</Link>
      </div>
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
      <label htmlFor={`reason-${revisionId}`}>What's wrong?</label>
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
