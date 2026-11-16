import type { CSSProperties } from "react";
import AnimatedSprite from "@/components/pixel/AnimatedSprite";
import { PALETTES } from "@/components/pixel/sprites";

interface DeepSpaceObservatoryProps {
  score: number;
  maxScore?: number;
  recentGain?: number | null;
  mark?: string | null;
  className?: string;
}

/** Distance tiers measured in Light-Years into the deep observatory field */
const RANGE_TIERS = [
  { ly: 0, label: "Dome Calibrated", sub: "Ground Station" },
  { ly: 250, label: "Solar Boundary", sub: "Kuiper Belt" },
  { ly: 500, label: "Stellar Cradle", sub: "Local Bubble" },
  { ly: 750, label: "Spiral Arm", sub: "Orion Nebula" },
  { ly: 1000, label: "Galactic Horizon", sub: "Deep Field" },
];

export default function DeepSpaceObservatory({
  score,
  maxScore = 500,
  recentGain = null,
  mark = null,
  className = "",
}: DeepSpaceObservatoryProps) {
  // 1 score pt = 2 Light-Years of observable range (500 pts = 1,000 Light-Years)
  const rangeLy = Math.round(score * 2);
  const progressRatio = Math.min(1, Math.max(0, score / maxScore));
  const rangePercent = (progressRatio * 100).toFixed(1);

  // Current tier
  const currentTier = [...RANGE_TIERS].reverse().find((t) => rangeLy >= t.ly) || RANGE_TIERS[0];

  return (
    <div className={`observatory-range-card ${className}`}>
      <div className="observatory-header">
        <div className="observatory-label-col">
          <span className="observatory-sub">OBSERVATORY HORIZON</span>
          <div className="observatory-val-row">
            <span className="observatory-val">{rangeLy.toLocaleString()}</span>
            <span className="observatory-unit">ly range</span>
            {recentGain != null && recentGain > 0 ? (
              <span className="observatory-gain-pill">
                +{recentGain * 2} ly {mark ? `(${mark})` : ""}
              </span>
            ) : null}
          </div>
        </div>
        <div className="observatory-tier-badge">
          <AnimatedSprite name="telescope" palette={PALETTES.telescope} size={15} />
          <span className="tier-name">{currentTier.label}</span>
        </div>
      </div>

      <div className="focal-track">
        {/* Deep space beam gradient */}
        <div className="focal-track-bg" />
        <div
          className="focal-track-fill"
          style={{ width: `${rangePercent}%` } as CSSProperties}
        />

        {/* Milestone nodes */}
        <div className="focal-milestones">
          {RANGE_TIERS.map((t) => {
            const pos = ((t.ly / 1000) * 100).toFixed(0);
            const reached = rangeLy >= t.ly;
            return (
              <div
                key={t.ly}
                className={`focal-node ${reached ? "reached" : ""}`}
                style={{ left: `${pos}%` } as CSSProperties}
                title={`${t.label}: ${t.ly} light-years`}
              >
                <div className="node-lens-pip" />
                <span className="node-ly-lbl">{t.ly} ly</span>
              </div>
            );
          })}
        </div>

        {/* Reticle / Lens Focus Indicator */}
        <div
          className="focus-reticle"
          style={{ left: `${rangePercent}%` } as CSSProperties}
        >
          <div className="reticle-sight">
            <div className="reticle-ring" />
            <div className="reticle-crosshair-v" />
            <div className="reticle-crosshair-h" />
          </div>
        </div>
      </div>
    </div>
  );
}
