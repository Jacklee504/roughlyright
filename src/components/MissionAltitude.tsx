import type { CSSProperties } from "react";
import AnimatedSprite from "@/components/pixel/AnimatedSprite";
import PixelSprite from "@/components/pixel/PixelSprite";
import { PALETTES, SATELLITE, SPACE_STATION, MOON, PLANET } from "@/components/pixel/sprites";

interface MissionAltitudeProps {
  score: number;
  maxScore?: number;
  recentGain?: number | null;
  mark?: string | null;
  className?: string;
}

/** Milestones in km of altitude */
const MILESTONES = [
  { km: 0, label: "Launchpad", icon: "launchpad" },
  { km: 120, label: "Troposphere", icon: "clouds" },
  { km: 350, label: "LEO Orbit", icon: "satellite" },
  { km: 700, label: "Station Dock", icon: "station" },
  { km: 1000, label: "Lunar Injection", icon: "moon" },
];

export default function MissionAltitude({
  score,
  maxScore = 500,
  recentGain = null,
  mark = null,
  className = "",
}: MissionAltitudeProps) {
  // 1 score point = 2 km of orbital altitude (500 pts = 1,000 km altitude)
  const altitudeKm = Math.round(score * 2);
  const progressRatio = Math.min(1, Math.max(0, score / maxScore));
  const altitudePercent = (progressRatio * 100).toFixed(1);

  // Current tier/zone
  const currentMilestone = [...MILESTONES].reverse().find((m) => altitudeKm >= m.km) || MILESTONES[0];

  return (
    <div className={`mission-altitude-card ${className}`}>
      <div className="altitude-header">
        <div className="altitude-label-col">
          <span className="altitude-sub">ORBITAL ASCENT</span>
          <div className="altitude-val-row">
            <span className="altitude-val">{altitudeKm.toLocaleString()}</span>
            <span className="altitude-unit">km alt</span>
            {recentGain != null && recentGain > 0 ? (
              <span className="altitude-gain-pill">
                +{recentGain * 2} km {mark ? `(${mark})` : ""}
              </span>
            ) : null}
          </div>
        </div>
        <div className="altitude-zone-badge">
          <span className="zone-indicator" />
          <span className="zone-name">{currentMilestone.label}</span>
        </div>
      </div>

      <div className="launch-track">
        {/* Track gradient representing atmospheric layers: Troposphere -> Stratosphere -> Orbit -> Deep Space */}
        <div className="launch-track-bg" />
        <div
          className="launch-track-fill"
          style={{ width: `${altitudePercent}%` } as CSSProperties}
        />

        {/* Milestone tick marks along the path */}
        <div className="track-milestones">
          {MILESTONES.map((m) => {
            const pos = ((m.km / 1000) * 100).toFixed(0);
            const reached = altitudeKm >= m.km;
            return (
              <div
                key={m.km}
                className={`track-node ${reached ? "reached" : ""}`}
                style={{ left: `${pos}%` } as CSSProperties}
                title={`${m.label}: ${m.km} km`}
              >
                <div className="node-pip" />
                <span className="node-lbl">{m.km}k</span>
              </div>
            );
          })}
        </div>

        {/* The ascending rocket vessel */}
        <div
          className="rocket-vessel"
          style={{ left: `${altitudePercent}%` } as CSSProperties}
        >
          <div className="rocket-sprite-container">
            <AnimatedSprite name="rocket" palette={PALETTES.rocket} size={28} />
          </div>
        </div>
      </div>
    </div>
  );
}
