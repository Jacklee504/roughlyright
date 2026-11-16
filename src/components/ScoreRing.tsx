"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";

/**
 * Animated score dial: gradient progress ring with the total centered inside.
 * The ring sweeps from zero on mount and the number counts up to the total
 * (both ease-out; the count-up is skipped entirely under reduced motion).
 */
export default function ScoreRing({
  total,
  max,
  size = 176,
}: {
  total: number;
  max: number;
  size?: number;
}) {
  const [mounted, setMounted] = useState(false);
  const [shown, setShown] = useState(0);
  const rafRef = useRef(0);

  useEffect(() => {
    const id = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(id);
  }, []);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setShown(total);
      return;
    }
    const start = performance.now();
    const dur = 1000;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / dur);
      const eased = 1 - Math.pow(1 - t, 3); // easeOutCubic
      setShown(Math.round(total * eased));
      if (t < 1) rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [total]);

  const frac = max > 0 ? Math.max(0, Math.min(1, total / max)) : 0;
  const r = 70;
  const c = 2 * Math.PI * r;

  return (
    <div className="score-wrap" style={{ width: size, height: size } as CSSProperties}>
      <svg
        className="score-ring"
        viewBox="0 0 160 160"
        role="img"
        aria-label={`Score ${total} of ${max}`}
      >
        <defs>
          <linearGradient id="ringGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#6ea8ff" />
            <stop offset="55%" stopColor="#8f7bff" />
            <stop offset="100%" stopColor="#b48cff" />
          </linearGradient>
        </defs>
        <circle cx="80" cy="80" r={r} fill="none" stroke="rgba(148,170,255,0.14)" strokeWidth="10" />
        <circle
          cx="80"
          cy="80"
          r={r}
          fill="none"
          stroke="url(#ringGrad)"
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={mounted ? c * (1 - frac) : c}
          transform="rotate(-90 80 80)"
          style={{ transition: "stroke-dashoffset 1.1s cubic-bezier(0.2, 0.7, 0.3, 1)" }}
        />
      </svg>
      <div className="ring-label" aria-hidden="true">
        <div>
          <div className="total">{shown}</div>
          <div className="denom">/ {max}</div>
        </div>
      </div>
    </div>
  );
}
