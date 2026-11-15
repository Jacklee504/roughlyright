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
      <section className="card">
        <h1>Roughly Right</h1>
        <p>
          Make five real-world estimates. Get closer to earn more points. No timer, no registration —
          just general knowledge, intuition and rough maths. A new puzzle every day at 00:00 UTC.
        </p>
      </section>

      {/* Primary game position. A second game (Rarity) takes the lead slot once both are public. */}
      <section className="card" aria-labelledby="estimation-heading">
        <span className="chip">Daily</span>
        <h2 id="estimation-heading">Estimation</h2>
        <p className="muted">
          {status.puzzleNumber
            ? `Puzzle #${status.puzzleNumber}${status.themeTag ? ` · ${status.themeTag}` : ""} · resets in your local time`
            : "A new puzzle is being prepared."}
        </p>
        <p className="muted small">
          Streak: {status.streak.current} current · {status.streak.best} best
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

      <section className="card">
        <h2>More games are coming</h2>
        <p className="muted">
          Roughly Right will host a small collection of daily games under one roof. Estimation is the
          first; the next one is on the way.
        </p>
      </section>
    </main>
  );
}
