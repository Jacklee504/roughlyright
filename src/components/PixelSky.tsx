"use client";

import { useEffect, useRef } from "react";
import { CONFETTI_COLORS } from "./pixel/sprites";

/**
 * The living sky — a low-resolution pixel canvas stretched over the viewport
 * behind the page content ("care & canvas", PlayPlain-style, in this site's
 * dark observatory palette):
 *
 * - drifting, twinkling pixel stars in the sprite palettes;
 * - a rare shooting star with a stepped pixel trail;
 * - an even rarer tiny rocket flyby (rising, wobbling, exhaust flicker);
 * - two faint aurora bands slowly breathing.
 *
 * Everything renders at a quarter resolution buffer scaled up with
 * `image-rendering: pixelated`, so it stays crisp-chunky and cheap. The loop
 * pauses when the tab is hidden, and `prefers-reduced-motion` renders a
 * single static starfield instead of animating.
 */
export default function PixelSky({ density = 64 }: { density?: number }) {
  const ref = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const SCALE = 4; // CSS px per buffer px
    let w = 0;
    let h = 0;
    let raf = 0;
    let running = true;

    type Star = { x: number; y: number; c: string; phase: number; speed: number; big: boolean };
    let stars: Star[] = [];
    type Shooter = { x: number; y: number; vx: number; vy: number; life: number; c: string };
    let shooter: Shooter | null = null;
    let nextShooterAt = 6 + Math.random() * 8;
    type Flyby = { x: number; y: number; wob: number; c: string };
    let flyby: Flyby | null = null;
    let nextFlybyAt = 14 + Math.random() * 12;

    const resize = () => {
      w = Math.max(1, Math.floor(window.innerWidth / SCALE));
      h = Math.max(1, Math.floor(window.innerHeight / SCALE));
      canvas.width = w;
      canvas.height = h;
      stars = Array.from({ length: density }, (_, i) => ({
        x: Math.random() * w,
        y: Math.random() * h,
        c: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
        phase: Math.random() * Math.PI * 2,
        speed: 0.15 + Math.random() * 0.35, // buffer px per second, downward drift
        big: Math.random() < 0.25,
      }));
    };
    resize();
    window.addEventListener("resize", resize);

    const ROCKET: [number, number, string | null][] = [
      // tiny 5×9 rocket for the buffer scale
      [-1, 0, null], [0, 0, "w"], [1, 0, "w"],
      [-1, 1, "w"], [0, 1, "w"], [1, 1, "w"],
      [0, 2, "w"], [0, 3, "y"], [0, 4, "o"],
    ];

    const draw = (t: number, dt: number) => {
      ctx.clearRect(0, 0, w, h);

      // Aurora bands: two sine-modulated strips, very low alpha.
      for (let band = 0; band < 2; band++) {
        const baseY = h * (0.18 + band * 0.16);
        ctx.fillStyle = band === 0 ? "rgba(95,227,195,0.05)" : "rgba(143,123,255,0.06)";
        for (let x = 0; x < w; x++) {
          const yy = Math.floor(baseY + Math.sin(x * 0.06 + t * 0.00012 + band * 2.1) * 5);
          ctx.fillRect(x, yy, 1, 2 + (band % 2));
        }
      }

      // Stars: drift + twinkle.
      for (const s of stars) {
        if (!reduced) {
          s.y += s.speed * dt;
          if (s.y > h + 2) s.y = -2;
        }
        const tw = reduced ? 1 : 0.45 + 0.55 * Math.abs(Math.sin(t * 0.0012 * (0.6 + s.speed) + s.phase));
        ctx.globalAlpha = s.big ? 0.9 * tw : 0.55 * tw;
        ctx.fillStyle = s.c;
        ctx.fillRect(Math.floor(s.x), Math.floor(s.y), 1, 1);
        if (s.big && tw > 0.85) {
          ctx.globalAlpha = 0.5;
          ctx.fillRect(Math.floor(s.x) - 1, Math.floor(s.y), 1, 1);
          ctx.fillRect(Math.floor(s.x) + 1, Math.floor(s.y), 1, 1);
          ctx.fillRect(Math.floor(s.x), Math.floor(s.y) - 1, 1, 1);
          ctx.fillRect(Math.floor(s.x), Math.floor(s.y) + 1, 1, 1);
        }
      }
      ctx.globalAlpha = 1;

      if (!reduced) {
        // Shooting star: short stepped trail.
        if (!shooter && t / 1000 > nextShooterAt) {
          shooter = {
            x: Math.random() * w * 0.7,
            y: Math.random() * h * 0.3,
            vx: 26 + Math.random() * 18,
            vy: 14 + Math.random() * 10,
            life: 0,
            c: "#e8eeff",
          };
        }
        if (shooter) {
          shooter.life += dt;
          shooter.x += shooter.vx * dt;
          shooter.y += shooter.vy * dt;
          ctx.fillStyle = shooter.c;
          for (let i = 0; i < 5; i++) {
            ctx.globalAlpha = 0.7 - i * 0.13;
            ctx.fillRect(Math.floor(shooter.x) - i * 2, Math.floor(shooter.y) - i, 1, 1);
          }
          ctx.globalAlpha = 1;
          if (shooter.x > w + 8 || shooter.y > h + 8) {
            shooter = null;
            nextShooterAt = t / 1000 + 7 + Math.random() * 9;
          }
        }

        // Rocket flyby: rises diagonally with a wobble.
        if (!flyby && t / 1000 > nextFlybyAt) {
          flyby = { x: 6 + Math.random() * (w - 12), y: h + 6, wob: Math.random() * Math.PI * 2, c: "#e8eeff" };
        }
        if (flyby) {
          flyby.y -= 9 * dt;
          flyby.wob += dt * 2.4;
          const fx = Math.floor(flyby.x + Math.sin(flyby.wob) * 2.5);
          const fy = Math.floor(flyby.y);
          ctx.fillStyle = "rgba(255,157,77,0.75)";
          ctx.fillRect(fx, fy + 5, 1, 1 + Math.floor(Math.random() * 2)); // exhaust
          for (const [dx, dy, c] of ROCKET) {
            if (!c) continue;
            ctx.fillStyle = c === "w" ? "#e8eeff" : c === "y" ? "#ffcf5c" : "#ff9d4d";
            ctx.fillRect(fx + dx, fy + dy, 1, 1);
          }
          if (flyby.y < -10) {
            flyby = null;
            nextFlybyAt = t / 1000 + 18 + Math.random() * 14;
          }
        }
      }
    };

    if (reduced) {
      draw(0, 0); // static starfield frame
    } else {
      let last = performance.now();
      let elapsed = 0;
      const loop = (now: number) => {
        if (!running) return;
        const dt = Math.min(0.05, (now - last) / 1000);
        last = now;
        elapsed = now;
        draw(elapsed, dt);
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
