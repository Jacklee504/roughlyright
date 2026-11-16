import { useId, type CSSProperties } from "react";
import PixelSprite from "./PixelSprite";
import { SPRITE_FRAMES, type AnimatedSpriteName, type Palette } from "./sprites";

/**
 * Multi-frame pixel animation, zero JS per frame: every frame is rendered as
 * a stacked SVG and visibility is cycled with a pure-CSS keyframes block
 * (negative delays offset each frame by exactly one slot, so exactly one
 * frame is visible at a time). Works in server components; honours the site
 * prefers-reduced-motion rule, which collapses animation durations globally.
 */
export default function AnimatedSprite({
  name,
  palette,
  size = 24,
  className,
  style,
}: {
  name: AnimatedSpriteName;
  palette: Palette;
  size?: number;
  className?: string;
  style?: CSSProperties;
}) {
  const id = useId().replace(/[:]/g, "");
  const { frames, fps } = SPRITE_FRAMES[name];
  const cycle = frames.length / fps;

  return (
    <span
      className={className ? `sprite-anim ${className}` : "sprite-anim"}
      style={{ width: size, height: size, ...style } as CSSProperties}
      aria-hidden="true"
    >
      <style>{`@keyframes spriteCycle-${id}{${frames
        .map((_, i) => {
          const start = (i / frames.length) * 100;
          const end = ((i + 1) / frames.length) * 100;
          return `${start.toFixed(3)}%{opacity:1}${end.toFixed(3)}%{opacity:0}`;
        })
        .join("")}}`}</style>
      {frames.map((frame, i) => (
        <span
          key={i}
          className="sprite-anim-frame"
          style={{
            animationName: `spriteCycle-${id}`,
            animationDuration: `${cycle}s`,
            animationTimingFunction: "steps(1, end)",
            animationIterationCount: "infinite",
            animationDelay: `${-(i / frames.length) * cycle}s`,
          }}
        >
          <PixelSprite sprite={frame} palette={palette} size={size} />
        </span>
      ))}
    </span>
  );
}
