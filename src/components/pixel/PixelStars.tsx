import PixelSprite from "./PixelSprite";
import { SPARKLE, PALETTES } from "./sprites";

/**
 * A sprinkle of twinkling pixel sparkles, absolutely positioned inside the
 * nearest positioned ancestor (add position:relative to the container).
 * Positions are derived deterministically from the index, so server and
 * client renders always match — no hydration drift.
 */
export default function PixelStars({
  count = 8,
  seed = 1,
}: {
  count?: number;
  seed?: number;
}) {
  const stars = Array.from({ length: count }, (_, i) => {
    const n = i * 2 + seed * 7;
    const x = 4 + ((n * 37) % 90);
    const y = 8 + ((n * 53) % 74);
    const size = i % 3 === 0 ? 10 : 7;
    const delay = `${(i % 6) * 0.42}s`;
    const palette =
      i % 3 === 0 ? PALETTES.starWarm : i % 3 === 1 ? PALETTES.star : PALETTES.starMint;
    return { x, y, size, delay, palette };
  });

  return (
    <div className="pixel-stars" aria-hidden="true">
      {stars.map((s, i) => (
        <span
          key={i}
          className="tw"
          style={{ left: `${s.x}%`, top: `${s.y}%`, animationDelay: s.delay }}
        >
          <PixelSprite sprite={SPARKLE} palette={s.palette} size={s.size} />
        </span>
      ))}
    </div>
  );
}
