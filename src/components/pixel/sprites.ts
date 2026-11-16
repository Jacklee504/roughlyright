/**
 * Pixel-art sprites — hand-drawn text grids.
 *
 * A sprite is an array of equal-length strings (the grid). Each character is
 * a palette key; "." is transparent. Static sprites are rendered by
 * PixelSprite as crisp SVG rects (shape-rendering: crispEdges). Animated
 * sprites list their frames in SPRITE_FRAMES and are cycled by
 * AnimatedSprite with pure CSS steps — zero JS per frame.
 *
 * Style notes (keep consistent when drawing new frames):
 * - 12-wide grids (SPARKLE is 7-wide, allowed), 12 rows, square viewBox.
 * - Two-tone shading: a darker companion colour for depth, never outlines.
 * - Palettes reuse the design-system accents (see globals.css :root).
 */

export type Palette = Record<string, string>;

/** Astronaut mascot: frame 2 blinks (visor eyes closed). */
const ASTRONAUT_OPEN = [
  "...wwwwww...",
  "..wwwwwwww..",
  ".wwwwwwwwww.",
  ".wwkkkkkkww.",
  ".wkkkkkkkkw.",
  ".wkkwkkwkkw.",
  ".wkkkkkkkkw.",
  ".wwkkkkkkww.",
  "..wwwwwwww..",
  "...wwwwww...",
  "....wwww....",
  "............",
];
const ASTRONAUT_BLINK = [
  "...wwwwww...",
  "..wwwwwwww..",
  ".wwwwwwwwww.",
  ".wwkkkkkkww.",
  ".wkkkkkkkkw.",
  ".wkkkkkkkkw.",
  ".wkkkkkkkkw.",
  ".wwkkkkkkww.",
  "..wwwwwwww..",
  "...wwwwww...",
  "....wwww....",
  "............",
];
export const ASTRONAUT = ASTRONAUT_OPEN;

/** Rocket: three exhaust flicker frames (bottom two rows vary). */
const ROCKET_BODY = [
  ".....rr.....",
  "....rwwr....",
  "....wwww....",
  "...wwyyww...",
  "...wwyyww...",
  "..wwwwwwww..",
  "..wwwwwwww..",
  ".rwwwwwwwwr.",
  ".rrwwwwwwrr.",
  ".rr.wwww.rr.",
];
export const ROCKET = [
  ...ROCKET_BODY,
  ".....oo.....",
  ".....oo.....",
];
const ROCKET_F2 = [
  ...ROCKET_BODY,
  "....oyyo....",
  ".....oo.....",
];
const ROCKET_F3 = [
  ...ROCKET_BODY,
  ".....oo.....",
  "....oyyo....",
];
export const ROCKET_FRAMES = [ROCKET, ROCKET_F2, ROCKET_F3, ROCKET_F2];

/** Flame: three flicker frames. */
export const FLAME = [
  ".....y......",
  "....yy......",
  "....yyy.....",
  "...yyyy.o...",
  "..oyyyyoo...",
  "..oyyyyoo...",
  ".ooyyyyooo..",
  ".ooyyyyooo..",
  ".oooyyyoooo.",
  "..ooyyoooo..",
  "...oooooo...",
  "....oooo....",
];
const FLAME_F2 = [
  "......y.....",
  "....yy......",
  "....yyy.....",
  "...yyyyo....",
  "..oyyyyoo...",
  "..oyyyyoo...",
  ".ooyyyyooo..",
  ".ooyyyyooo..",
  ".oooyyyooo..",
  "..ooyyoooo..",
  "...oooooo...",
  "....oooo....",
];
const FLAME_F3 = [
  "....y.......",
  ".....yy.....",
  "....yyy.....",
  "..oyyyy.....",
  "..oyyyyoo...",
  "..oyyyyoo...",
  ".ooyyyyooo..",
  ".oooyyyooo..",
  ".oooyyyoooo.",
  "..ooyyoooo..",
  "...oooooo...",
  "....oooo....",
];
export const FLAME_FRAMES = [FLAME, FLAME_F2, FLAME_F3, FLAME_F2];

/** Trophy (static; the shine is a CSS sweep on the wrapper). */
export const TROPHY = [
  ".oooooooooo.",
  ".oyyyyyyyyo.",
  ".oyyyyyyyyo.",
  "..oyyyyyyo..",
  "...oyyyyo...",
  "....oyyo....",
  ".....yy.....",
  "...yyyyyy...",
  "..oooooooo..",
  "..oooooooo..",
  ".oooooooooo.",
  "............",
];

export const PLANET = [
  "....llll....",
  "..ll....ll..",
  ".l.pppppp.l.",
  ".lppplppppl.",
  "..ppplpppp..",
  "...pppppp...",
  "...pppppp...",
  "..pppppppp..",
  ".l.pppppp.l.",
  "..ll....ll..",
  "....llll....",
  "............",
];

/** Crescent moon with two subtle crater frames (slow "phase" shimmer). */
export const MOON = [
  "....wwww....",
  "..ww....ww..",
  ".ww......w..",
  ".w..........",
  ".w..........",
  "w......d....",
  ".w..........",
  ".w..........",
  ".w......d...",
  ".ww......w..",
  "..ww....ww..",
  "....wwww....",
];
const MOON_F2 = [
  "....wwww....",
  "..ww....ww..",
  ".ww......w..",
  ".w..........",
  ".w.....d....",
  "w...........",
  ".w..........",
  ".w.....d....",
  ".w..........",
  ".ww......w..",
  "..ww....ww..",
  "....wwww....",
];
export const MOON_FRAMES = [MOON, MOON, MOON_F2, MOON_F2];

/** UFO: frame 2 lowers the tractor beam. */
export const UFO = [
  "............",
  "............",
  "....wwww....",
  "...wwwwww...",
  "..wyywwyyw..",
  ".wwwwwwwwww.",
  ".wkwwkkwwkw.",
  "..wwwwwwww..",
  "............",
  "............",
  "............",
  "............",
];
const UFO_BEAM = [
  "............",
  "............",
  "....wwww....",
  "...wwwwww...",
  "..wyywwyyw..",
  ".wwwwwwwwww.",
  ".wkwwkkwwkw.",
  "..wwwwwwww..",
  "....d..d....",
  "...d....d...",
  "....d..d....",
  "............",
];
export const UFO_FRAMES = [UFO, UFO, UFO_BEAM, UFO_BEAM, UFO, UFO];

export const SPARKLE = [
  "...w...",
  "..wXw..",
  ".wXXXw.",
  "wXXXXXw",
  ".wXXXw.",
  "..wXw..",
  "...w...",
];
const SPARKLE_SMALL = [
  ".......",
  "...w...",
  "..wXw..",
  "...w...",
  ".......",
  ".......",
  ".......",
];
export const SPARKLE_FRAMES = [SPARKLE, SPARKLE_SMALL];

/** Multi-frame animation table for AnimatedSprite. */
export const SPRITE_FRAMES = {
  astronaut: { frames: [ASTRONAUT_OPEN, ASTRONAUT_BLINK, ASTRONAUT_OPEN, ASTRONAUT_OPEN], fps: 1.2 },
  rocket: { frames: ROCKET_FRAMES, fps: 8 },
  flame: { frames: FLAME_FRAMES, fps: 7 },
  moon: { frames: MOON_FRAMES, fps: 0.8 },
  ufo: { frames: UFO_FRAMES, fps: 2.5 },
  sparkle: { frames: SPARKLE_FRAMES, fps: 2.2 },
} as const;

export type AnimatedSpriteName = keyof typeof SPRITE_FRAMES;

/** Shared palettes; a gray/ghost variant of any sprite reads as "inactive". */
export const PALETTES = {
  astronaut: { w: "#e8eeff", k: "#0d1430", y: "#8ab4ff" } satisfies Palette,
  rocket: { w: "#e8eeff", r: "#ff7d8a", y: "#ffcf5c", o: "#ff9d4d" } satisfies Palette,
  trophy: { y: "#ffd75c", o: "#c9953a" } satisfies Palette,
  flame: { o: "#ff9d4d", y: "#ffcf5c" } satisfies Palette,
  planet: { p: "#8f7bff", l: "#b48cff" } satisfies Palette,
  moon: { w: "#e8eeff", d: "#9aa8cc" } satisfies Palette,
  ufo: { w: "#e8eeff", y: "#8ab4ff", k: "#0d1430", d: "#4a5e8f" } satisfies Palette,
  ghost: { p: "#5a647f", l: "#4a5470" } satisfies Palette,
  star: { w: "#dfe7ff", X: "#8ab4ff" } satisfies Palette,
  starWarm: { w: "#ffe9a3", X: "#ffcf5c" } satisfies Palette,
  starMint: { w: "#b9ffe8", X: "#5fe3c3" } satisfies Palette,
} as const;

/** Pixel-confetti colours (canvas), matching the sprite palettes. */
export const CONFETTI_COLORS = ["#6ea8ff", "#8f7bff", "#b48cff", "#5fe3c3", "#ffcf5c", "#ff9d4d", "#ff7d8a", "#e8eeff"];
