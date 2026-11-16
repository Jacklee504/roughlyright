"use client";

import { useEffect, useRef } from "react";
import { CONFETTI_COLORS } from "./pixel/sprites";

/**
 * Pixel confetti — a short, one-shot canvas burst inside the nearest
 * positioned ancestor (add position:relative to the container). Chunky
 * quarter-scaled pixels fall and tumble like the DOM Burst, but with real
 * numbers of particles, gravity, drift and a fade-out, then the canvas
 * removes itself. No-op under prefers-reduced-motion.
 */
export default function PixelConfetti({
  count = 64,
  duration = 2.6,
}: {
  count?: number;
  duration?: number;
}) {
  const ref = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const SCALE = 3; // chunk factor: one particle pixel = SCALE CSS px
    let w = 0;
    let h = 0;
    let raf = 0;
    const parent = canvas.parentElement;

    type P = { x: number; y: number; vx: number; vy: number; c: string; life: number; wobble: number };
    let parts: P[] = [];

    const resize = () => {
      const rect = parent?.getBoundingClientRect();
      w = Math.max(1, Math.floor((rect?.width ?? window.innerWidth) / SCALE));
      h = Math.max(1, Math.floor((rect?.height ?? window.innerHeight) / SCALE));
      canvas.width = w;
      canvas.height = h;
    };
    resize();
    window.addEventListener("resize", resize);

    parts = Array.from({ length: count }, () => ({
      x: w * (0.2 + Math.random() * 0.6),
      y: h * 0.28 + Math.random() * h * 0.1,
      vx: (Math.random() - 0.5) * 30,
      vy: -(30 + Math.random() * 55),
      c: CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)],
      life: 0,
      wobble: Math.random() * Math.PI * 2,
    }));

    const start = performance.now();
    let last = start;
    const loop = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const age = (now - start) / 1000;
      ctx.clearRect(0, 0, w, h);
      for (const p of parts) {
        p.life += dt;
        p.wobble += dt * 6;
        p.vy += 130 * dt; // gravity
        p.vx *= 0.995;
        p.x += p.vx * dt + Math.sin(p.wobble) * 0.3;
        p.y += p.vy * dt;
        const fade = Math.max(0, 1 - age / duration);
        ctx.globalAlpha = fade;
        ctx.fillStyle = p.c;
        ctx.fillRect(Math.floor(p.x), Math.floor(p.y), 1, 1);
      }
      ctx.globalAlpha = 1;
      if (age < duration) raf = requestAnimationFrame(loop);
      else ctx.clearRect(0, 0, w, h);
    };
    raf = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
    };
  }, [count, duration]);

  return <canvas ref={ref} className="pixel-confetti" aria-hidden="true" />;
}
