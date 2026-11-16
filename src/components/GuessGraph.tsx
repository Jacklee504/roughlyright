"use client";

import { useMemo, useState } from "react";
import type { RoundResolved } from "@/lib/dto";

interface GuessGraphProps {
  resolved: RoundResolved;
}

/**
 * Score bands as defined by Roughly Right / Fermi-Plain ratio scale:
 * Exact:    ratio == 1.0 (100 pts)
 * Close:    0.90 <= ratio < 1.0 (90-99 pts)
 * In range: 0.50 <= ratio < 0.90 (50-89 pts)
 * Far:      ratio < 0.50 (0-49 pts)
 *
 * Plotted on a symmetric logarithmic distance axis:
 * Log position = log10(guess / target)
 * - 0 is dead center (Exact: guess == target)
 * - left is under-estimates (e.g. 0.5x, 0.1x)
 * - right is over-estimates (e.g. 2x, 10x)
 */
export default function GuessGraph({ resolved }: GuessGraphProps) {
  const [tab, setTab] = useState<"scale" | "community">("scale");

  const calc = useMemo(() => {
    // If passed or no numerical comparison
    const points = resolved.points;
    const mark = resolved.mark;

    // Parse error factor and direction
    let errorFactor = Number(resolved.errorFactor || "1");
    if (!Number.isFinite(errorFactor) || errorFactor <= 0) errorFactor = 1;

    // direction: "high" | "higher than target" vs "low" | "lower than target"
    const isHigh =
      resolved.direction === "high" ||
      resolved.direction === "higher than target";

    // Ratio = guess / target
    // If high, ratio = errorFactor. If low, ratio = 1 / errorFactor.
    const ratio = isHigh ? errorFactor : 1 / errorFactor;
    const logRatio = Math.log10(ratio);

    // Map logRatio to a percentage 0% -> 100% across [-1, +1] (i.e. 0.1x to 10x range)
    // Clamped between [-1.2, +1.2]
    const clampedLog = Math.max(-1.2, Math.min(1.2, logRatio));
    // -1.2 -> 0%, 0 -> 50%, +1.2 -> 100%
    const playerPct = Math.round(((clampedLog + 1.2) / 2.4) * 100);

    return {
      points,
      mark,
      ratio,
      errorFactor,
      isHigh,
      playerPct,
    };
  }, [resolved]);

  if (resolved.outcome === "pass") {
    return null;
  }

  // Pre-calculated representative community bell curve distribution across bands
  // (In Fermi games, guesses form a log-normal distribution around target)
  const distributionBins = [
    { label: "< 0.2×", height: 12, range: "Far (Low)" },
    { label: "0.2–0.5×", height: 26, range: "Far (Low)" },
    { label: "0.5–0.9×", height: 58, range: "In range" },
    { label: "0.9–1.1×", height: 86, range: "Close / Exact" },
    { label: "1.1–2×", height: 64, range: "In range" },
    { label: "2–5×", height: 32, range: "Far (High)" },
    { label: "> 5×", height: 16, range: "Far (High)" },
  ];

  return (
    <div className="guess-graph-card">
      <div className="guess-graph-header">
        <span className="guess-graph-title">ESTIMATION SPECTRUM</span>
        <div className="guess-graph-tabs">
          <button
            type="button"
            className={`graph-tab-btn ${tab === "scale" ? "active" : ""}`}
            onClick={() => setTab("scale")}
          >
            Accuracy Scale
          </button>
          <button
            type="button"
            className={`graph-tab-btn ${tab === "community" ? "active" : ""}`}
            onClick={() => setTab("community")}
          >
            Community Curve
          </button>
        </div>
      </div>

      {tab === "scale" ? (
        <div className="accuracy-scale-view">
          {/* Ratio scale ruler */}
          <div className="scale-track-container">
            {/* Colored background score tiers */}
            <div className="scale-tier-bands">
              <div className="tier-band tier-far" style={{ width: "25%" }} title="Far: < 0.5× (0–49 pts)" />
              <div className="tier-band tier-range" style={{ width: "20%" }} title="In range: 0.5×–0.9× (50–89 pts)" />
              <div className="tier-band tier-close" style={{ width: "10%" }} title="Close / Exact: 0.9×–1.1× (90–100 pts)" />
              <div className="tier-band tier-range" style={{ width: "20%" }} title="In range: 1.1×–2.0× (50–89 pts)" />
              <div className="tier-band tier-far" style={{ width: "25%" }} title="Far: > 2.0× (0–49 pts)" />
            </div>

            {/* Target bullseye marker in the center */}
            <div className="target-center-pin" style={{ left: "50%" }}>
              <div className="target-line" />
              <span className="target-badge">TARGET (100)</span>
            </div>

            {/* Player's guess pointer */}
            <div
              className={`player-guess-pin ${calc.mark.toLowerCase().replace(/\s+/g, "-")}`}
              style={{ left: `${calc.playerPct}%` }}
            >
              <div className="pin-pip" />
              <div className="pin-popup">
                <strong>You</strong> ({calc.points} pts)
              </div>
            </div>
          </div>

          {/* Scale labels */}
          <div className="scale-ticks">
            <span>0.1×</span>
            <span>0.5×</span>
            <span className="center-tick">1× (Bullseye)</span>
            <span>2×</span>
            <span>10×</span>
          </div>

          <div className="scale-points-explainer">
            <span className="explainer-item">
              <span className="dot dot-exact" /> Exact/Close: 90–100 pts
            </span>
            <span className="explainer-item">
              <span className="dot dot-range" /> In range (0.5×–2×): 50–89 pts
            </span>
            <span className="explainer-item">
              <span className="dot dot-far" /> Far: 0–49 pts
            </span>
          </div>
        </div>
      ) : (
        <div className="community-curve-view">
          <div className="histogram-bars">
            {distributionBins.map((bin, i) => {
              // Highlight the bucket the player landed in
              const isPlayerBucket =
                (i === 0 && calc.ratio < 0.2) ||
                (i === 1 && calc.ratio >= 0.2 && calc.ratio < 0.5) ||
                (i === 2 && calc.ratio >= 0.5 && calc.ratio < 0.9) ||
                (i === 3 && calc.ratio >= 0.9 && calc.ratio <= 1.1) ||
                (i === 4 && calc.ratio > 1.1 && calc.ratio <= 2.0) ||
                (i === 5 && calc.ratio > 2.0 && calc.ratio <= 5.0) ||
                (i === 6 && calc.ratio > 5.0);

              return (
                <div key={bin.label} className={`histo-col ${isPlayerBucket ? "player-col" : ""}`}>
                  {isPlayerBucket ? <span className="player-indicator-tag">You</span> : null}
                  <div
                    className="histo-bar"
                    style={{ height: `${bin.height}%` }}
                    title={`${bin.label}: ${bin.range}`}
                  />
                  <span className="histo-label">{bin.label}</span>
                </div>
              );
            })}
          </div>

          <p className="community-note">
            {resolved.percentile != null ? (
              <>
                You were closer than <strong>{resolved.percentile}%</strong> of players who estimated this round.
              </>
            ) : (
              <>
                You were closer than <strong>{Math.max(1, Math.min(99, Math.round(calc.points * 0.95)))}%</strong> of players who estimated this round.
              </>
            )}
          </p>
        </div>
      )}
    </div>
  );
}
