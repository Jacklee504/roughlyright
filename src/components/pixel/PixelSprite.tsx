import type { CSSProperties } from "react";
import type { Palette } from "./sprites";

/**
 * Renders a pixel-art sprite (see sprites.ts) as an inline SVG of crisp
 * rects. Horizontal runs of same-colour pixels are merged to keep the DOM
 * small. No client hooks — safe in server components.
 */
export default function PixelSprite({
  sprite,
  palette,
  size = 24,
  className,
  style,
}: {
  sprite: string[];
  palette: Palette;
  /** Rendered width/height in px (sprites are square). */
  size?: number;
  className?: string;
  style?: CSSProperties;
}) {
  const h = sprite.length;
  const w = sprite[0]?.length ?? 0;
  const rects: React.ReactElement[] = [];

  sprite.forEach((row, y) => {
    let x = 0;
    while (x < row.length) {
      const ch = row[x];
      if (ch === "." || !palette[ch]) {
        x++;
        continue;
      }
      let runEnd = x;
      while (runEnd + 1 < row.length && row[runEnd + 1] === ch) runEnd++;
      rects.push(
        <rect
          key={`${x}-${y}`}
          x={x}
          y={y}
          width={runEnd - x + 1}
          height={1}
          fill={palette[ch]}
        />,
      );
      x = runEnd + 1;
    }
  });

  return (
    <svg
      className={className ? `sprite ${className}` : "sprite"}
      viewBox={`0 0 ${w} ${h}`}
      width={size}
      height={size}
      shapeRendering="crispEdges"
      aria-hidden="true"
      focusable="false"
      style={style}
    >
      {rects}
    </svg>
  );
}
