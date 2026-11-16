"use client";

import { useEffect, useRef } from "react";

/**
 * Clean scientific laboratory ambient canvas:
 * Subtle technical oscilloscope grid lines, faint metric crosshairs,
 * and gentle electrical signal pulses moving across coordinates.
 */
export default function LabGrid({ density = 32 }: { density?: number }) {
  const ref = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const SCALE = 2;
    let w = 0;
    let h = 0;
    let raf = 0;
    let running = true;

    const resize = () => {
      w = Math.max(1, Math.floor(window.innerWidth / SCALE));
      h = Math.max(1, Math.floor(window.innerHeight / SCALE));
      canvas.width = w;
      canvas.height = h;
    };
    resize();
    window.addEventListener("resize", resize);

    type Pulse = { x: number; y: number; speed: number; length: number; alpha: number };
    const pulses: Pulse[] = Array.from({ length: 6 }, () => ({
      x: Math.random() * (w || 400),
      y: Math.floor(Math.random() * ((h || 300) / 40)) * 40,
      speed: 30 + Math.random() * 40,
      length: 20 + Math.random() * 40,
      alpha: 0.15 + Math.random() * 0.2,
    }));

    const draw = (t: number, dt: number) => {
      ctx.clearRect(0, 0, w, h);

      // Fine coordinate grid
      ctx.strokeStyle = "rgba(138, 180, 255, 0.04)";
      ctx.lineWidth = 1;
      const step = 36;

      ctx.beginPath();
      for (let x = 0; x < w; x += step) {
        ctx.moveTo(x, 0);
        ctx.lineTo(x, h);
      }
      for (let y = 0; y < h; y += step) {
        ctx.moveTo(0, y);
        ctx.lineTo(w, y);
      }
      ctx.stroke();

      // Subtle oscilloscope horizontal test pulse
      if (!reduced) {
        for (const p of pulses) {
          p.x += p.speed * dt;
          if (p.x > w + p.length) {
            p.x = -p.length;
            p.y = Math.floor(Math.random() * (h / step)) * step;
          }

          const grad = ctx.createLinearGradient(p.x, p.y, p.x + p.length, p.y);
          grad.addColorStop(0, "rgba(95, 227, 195, 0)");
          grad.addColorStop(0.7, `rgba(95, 227, 195, ${p.alpha})`);
          grad.addColorStop(1, "rgba(138, 180, 255, 0)");

          ctx.strokeStyle = grad;
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.moveTo(p.x, p.y);
          ctx.lineTo(p.x + p.length, p.y);
          ctx.stroke();
        }
      }
    };

    if (reduced) {
      draw(0, 0);
    } else {
      let last = performance.now();
      const loop = (now: number) => {
        if (!running) return;
        const dt = Math.min(0.05, (now - last) / 1000);
        last = now;
        draw(now, dt);
        raf = requestAnimationFrame(loop);
      };
      raf = requestAnimationFrame(loop);

      const onVisibility = () => {
        running = !document.hidden;
        if (running) {
          last = performance.now();
          raf = requestAnimationFrame(loop);
        } else {
          cancelAnimationFrame(raf);
        }
      };
      document.addEventListener("visibilitychange", onVisibility);
      return () => {
        running = false;
        cancelAnimationFrame(raf);
        document.removeEventListener("visibilitychange", onVisibility);
        window.removeEventListener("resize", resize);
      };
    }

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
    };
  }, [density]);

  return <canvas ref={ref} className="pixel-sky" aria-hidden="true" />;
}
