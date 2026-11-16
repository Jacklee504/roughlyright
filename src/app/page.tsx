import Link from "next/link";
import { getGuestId } from "@/lib/http/session";
import { getGameStatus } from "@/lib/service/status";
import { SIBLING_GAMES } from "@/lib/site";
import PixelSprite from "@/components/pixel/PixelSprite";
import LabGrid from "@/components/LabGrid";
import AnimatedSprite from "@/components/pixel/AnimatedSprite";
import { TROPHY, BALANCE, PALETTES } from "@/components/pixel/sprites";

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
      <LabGrid density={32} />
      <section className="hero">
        <AnimatedSprite name="scientist" palette={PALETTES.scientist} size={46} className="hero-mascot" />
        <span className="chip">Daily estimation</span>
        <h1>
          Roughly <span className="grad-text">Right</span>
        </h1>
        <p className="tagline">
          Five real-world estimates a day. Get closer to earn more points. No timer, no
          registration — just general knowledge, intuition and rough maths.
        </p>
        <div className="pills">
          <span className="pill">🧭 5 rounds a day</span>
          <span className="pill">🔬 Metric calibration</span>
          <span className="pill">🎯 Scored /500</span>
          <span className="pill">🌅 Resets 00:00 UTC</span>
          {status.streak.current > 0 || status.streak.best > 0 ? (
            <span className="pill">
              <AnimatedSprite name="flask" palette={PALETTES.flask} size={13} />
              {status.streak.current} streak · best {status.streak.best}
            </span>
          ) : null}
        </div>
        <div className="pixel-rule" aria-hidden="true" />
      </section>

      <section className="card" aria-labelledby="estimation-heading">
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <span className="chip">
            <AnimatedSprite name="oscilloscope" palette={PALETTES.oscilloscope} size={13} /> Daily
          </span>
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
          <AnimatedSprite name="sparkle" palette={PALETTES.sparkle} size={20} />
          <strong>Estimate</strong>
          <span>Type a number — suffixes like 5k are fine, typos get gently corrected.</span>
        </div>
        <div className="feature">
          <AnimatedSprite name="oscilloscope" palette={PALETTES.oscilloscope} size={20} />
          <strong>Calibrate</strong>
          <span>Closer estimates tighten your calibration index toward national standards.</span>
        </div>
        <div className="feature">
          <PixelSprite sprite={TROPHY} palette={PALETTES.trophy} size={20} />
          <strong>Compare</strong>
          <span>Share spoiler-free marks and compare estimation accuracy curves with friends.</span>
        </div>
      </section>

      {SIBLING_GAMES.length > 0 ? (
        <p className="muted small" style={{ textAlign: "center", marginTop: 20 }}>
          Enjoying this? {SIBLING_GAMES.map((g, i) => (
            <span key={g.url}>
              {i > 0 ? " · " : ""}
              <a href={g.url}>{g.name}</a> — {g.blurb}
            </span>
          ))}
        </p>
      ) : null}
    </main>
  );
}
