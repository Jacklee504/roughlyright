import type { RoundResolved } from "@/lib/dto";

type GuessReading = Pick<RoundResolved, "outcome" | "mark" | "direction" | "errorFactor">;

const SCALE_TICKS = [
  { ratio: 0.1, label: "0.1×" },
  { ratio: 0.5, label: "0.5×" },
  { ratio: 1, label: "Target" },
  { ratio: 2, label: "2×" },
  { ratio: 10, label: "10×" },
];

function position(ratio: number): number {
  return Math.max(0, Math.min(100, 50 + 50 * Math.log10(ratio)));
}

export default function GuessGraph({ resolved }: { resolved: GuessReading }) {
  if (resolved.outcome === "pass" || !resolved.errorFactor) return null;

  const factor = Number(resolved.errorFactor);
  if (!Number.isFinite(factor) || factor <= 0) return null;
  const high = resolved.direction === "high" || resolved.direction === "higher than target";
  const positionOnScale = position(high ? factor : 1 / factor);
  const factorDisplay = new Intl.NumberFormat("en", { maximumSignificantDigits: 3 }).format(factor);
  let distance = "On target";
  if (resolved.mark !== "Exact") {
    const side = high ? "high" : "low";
    distance = factorDisplay === "1"
      ? `Slightly too ${side}`
      : `${factorDisplay}× too ${side}${factor > 10 ? " · beyond scale" : ""}`;
  }

  return (
    <figure className="estimate-scale">
      <figcaption><span>Distance from target</span><strong>{distance}</strong></figcaption>
      <div className="estimate-track" aria-hidden="true">
        <span className="estimate-band" style={{ left: `${position(0.5)}%`, right: `${100 - position(2)}%` }} />
        <span className="estimate-band near" style={{ left: `${position(0.9)}%`, right: `${100 - position(1 / 0.9)}%` }} />
        <span className="estimate-center" />
        <span className="estimate-pin" style={{ left: `${positionOnScale}%` }} />
      </div>
      <div className="estimate-ticks" aria-hidden="true">
        {SCALE_TICKS.map(({ ratio, label }) => <span key={ratio} style={{ left: `${position(ratio)}%` }}>{label}</span>)}
      </div>
    </figure>
  );
}
