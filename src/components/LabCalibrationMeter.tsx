import type { CSSProperties } from "react";
import AnimatedSprite from "@/components/pixel/AnimatedSprite";
import { PALETTES } from "@/components/pixel/sprites";

interface LabCalibrationMeterProps {
  score: number;
  maxScore?: number;
  recentGain?: number | null;
  mark?: string | null;
  className?: string;
}

/** Calibration stages from coarse estimation to metrology standard */
const CALIBRATION_TIERS = [
  { val: 0, label: "Uncalibrated", sub: "Raw Signal", symbol: "±∞" },
  { val: 200, label: "Ballpark Band", sub: "Order of Magnitude", symbol: "±10×" },
  { val: 400, label: "Empirical Spec", sub: "Standard Deviation", symbol: "±2×" },
  { val: 700, label: "Precision Grade", sub: "Laboratory Grade", symbol: "±10%" },
  { val: 1000, label: "National Standard", sub: "NIST Metrology", symbol: "Exact" },
];

export default function LabCalibrationMeter({
  score,
  maxScore = 500,
  recentGain = null,
  mark = null,
  className = "",
}: LabCalibrationMeterProps) {
  // Score mapped to 0..1000 calibration index (500 pts = 1000 index, 100% precision calibration)
  const calIndex = Math.round(score * 2);
  const progressRatio = Math.min(1, Math.max(0, score / maxScore));
  const calPercent = (progressRatio * 100).toFixed(1);

  // Current calibration grade tier
  const currentTier = [...CALIBRATION_TIERS].reverse().find((t) => calIndex >= t.val) || CALIBRATION_TIERS[0];

  return (
    <div className={`calibration-meter-card ${className}`}>
      <div className="cal-header">
        <div className="cal-label-col">
          <span className="cal-sub">METROLOGY CALIBRATION</span>
          <div className="cal-val-row">
            <span className="cal-val">{calIndex}</span>
            <span className="cal-unit">/1000 cal</span>
            {recentGain != null && recentGain > 0 ? (
              <span className="cal-gain-pill">
                +{recentGain * 2} cal {mark ? `(${mark})` : ""}
              </span>
            ) : null}
          </div>
        </div>
        <div className="cal-grade-badge">
          <AnimatedSprite name="oscilloscope" palette={PALETTES.oscilloscope} size={16} />
          <span className="grade-name">{currentTier.label}</span>
          <span className="grade-tolerance">{currentTier.symbol}</span>
        </div>
      </div>

      <div className="vernier-track">
        {/* Analog gauge ruler track */}
        <div className="vernier-track-bg" />
        <div
          className="vernier-track-fill"
          style={{ width: `${calPercent}%` } as CSSProperties}
        />

        {/* Graduation scale ticks */}
        <div className="vernier-milestones">
          {CALIBRATION_TIERS.map((t) => {
            const pos = ((t.val / 1000) * 100).toFixed(0);
            const reached = calIndex >= t.val;
            return (
              <div
                key={t.val}
                className={`vernier-node ${reached ? "reached" : ""}`}
                style={{ left: `${pos}%` } as CSSProperties}
                title={`${t.label}: ${t.sub} (${t.symbol})`}
              >
                <div className="node-graduation-line" />
                <span className="node-cal-lbl">{t.val}</span>
              </div>
            );
          })}
        </div>

        {/* Vernier dial indicator */}
        <div
          className="vernier-cursor"
          style={{ left: `${calPercent}%` } as CSSProperties}
        >
          <div className="cursor-sight">
            <div className="needle-pointer" />
            <div className="needle-hub" />
          </div>
        </div>
      </div>
    </div>
  );
}
