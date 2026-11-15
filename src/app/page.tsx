import Link from "next/link";
import { getGuestId } from "@/lib/http/session";
import { getGameStatus } from "@/lib/service/status";

export const dynamic = "force-dynamic";

export default async function LandingPage() {
  const guestId = await getGuestId();
  const status = await getGameStatus("estimation", guestId);

  const label = !status.puzzleAvailable
    ? "Estimation is unavailable right now"
    : status.attempt?.state === "completed"
      ? "View today's results"
      : status.attempt?.state === "active"
        ? "Continue today's Estimation"
        : status.attempt?.state === "expired"
          ? "Estimation — new daily is ready"
          : "Play today's Estimation";

  return (
    <main>
      <section className="hero">
        <span className="chip">Daily games · one roof</span>
        <h1>
          Roughly <span className="grad-text">Right</span>
        </h1>
        <p className="tagline">
          Five real-world estimates a day. Get closer to earn more points. No timer, no
          registration — just general knowledge, intuition and rough maths.
        </p>
        <div className="pills">
          <span className="pill">🧭 5 rounds a day</span>
          <span className="pill">🎯 Scored /500</span>
          <span className="pill">🌅 Resets 00:00 UTC</span>
          {status.streak.current > 0 || status.streak.best > 0 ? (
            <span className="pill">🔥 {status.streak.current} streak · best {status.streak.best}</span>
          ) : null}
        </div>
      </section>

      {/* Primary game position. A second game (Rarity) takes the lead slot once both are public. */}
      <section className="card" aria-labelledby="estimation-heading">
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <span className="chip">🛰️ Daily</span>
          <h2 id="estimation-heading" style={{ margin: 0 }}>Estimation</h2>
        </div>
        <p className="muted">
          {status.puzzleNumber
            ? `Puzzle #${status.puzzleNumber}${status.themeTag ? ` · ${status.themeTag}` : ""}`
            : "A new puzzle is being prepared."}
        </p>
        <div className="actions">
          {status.puzzleAvailable ? (
            <Link className="btn" href="/estimation">{label}</Link>
          ) : (
            <span className="muted">The daily is unavailable — check back after the next reset.</span>
          )}
          <Link className="btn" href="/estimation/archive">Archive</Link>
        </div>
      </section>

      <section className="feature-row" aria-label="How it works">
        <div className="feature">
          <span className="ico" aria-hidden="true">🤔</span>
          <strong>Guess</strong>
          <span>Type a number — suffixes like 5k are fine, typos get gently corrected.</span>
        </div>
        <div className="feature">
          <span className="ico" aria-hidden="true">📏</span>
          <strong>Score</strong>
          <span>Exact, Close, In range, Far — every round shows how your guess landed.</span>
        </div>
        <div className="feature">
          <span className="ico" aria-hidden="true">🔗</span>
          <strong>Compare</strong>
          <span>Share spoiler-free marks; per-question comparison for friends who played.</span>
        </div>
      </section>

      <section className="card">
        <h2>More games are coming</h2>
        <p className="muted">
          Roughly Right will host a small collection of daily games under one roof. Estimation is
          the first; the next one is on the way.
        </p>
      </section>
    </main>
  );
}
