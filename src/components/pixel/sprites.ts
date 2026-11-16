/**
 * Pixel-art sprites — hand-drawn technical & laboratory grids.
 *
 * Grids: 12-wide, 12 rows, square viewBox (shape-rendering: crispEdges).
 * Two-tone shading for depth, no harsh black borders.
 */

export type Palette = Record<string, string>;

/** Laboratory Scientist / Researcher Mascot: blinking safety goggles */
const SCIENTIST_OPEN = [
  "...wwwwww...",
  "..wwwwwwww..",
  ".wwwwwwwwww.",
  ".wccccccccw.",
  ".wccccccccw.",
  ".wcckcckccw.",
  ".wccccccccw.",
  ".wwkkkkkkww.",
  "..wwwwwwww..",
  "...wwwwww...",
  "...wwwwww...",
  "....wwww....",
];

const SCIENTIST_BLINK = [
  "...wwwwww...",
  "..wwwwwwww..",
  ".wwwwwwwwww.",
  ".wccccccccw.",
  ".wccccccccw.",
  ".wccccccccw.",
  ".wccccccccw.",
  ".wwkkkkkkww.",
  "..wwwwwwww..",
  "...wwwwww...",
  "...wwwwww...",
  "....wwww....",
];

export const SCIENTIST = SCIENTIST_OPEN;

/** Laboratory Flask / Beaker: bubbling liquid inside */
const FLASK_F1 = [
  "....wwww....",
  "....w..w....",
  "....w..w....",
  "...w....w...",
  "..w..gg..w..",
  ".w..gggg..w.",
  ".w.gggggg.w.",
  ".w.gggggg.w.",
  ".w.ggyygg.w.",
  ".wggggggggw.",
  "..wwwwwwww..",
  "............",
];

const FLASK_F2 = [
  "....wwww....",
  "....w..w....",
  "....w..w....",
  "...w....w...",
  "..w.gg...w..",
  ".w..gggg..w.",
  ".w.ggyygg.w.",
  ".w.gggggg.w.",
  ".w..gggg..w.",
  ".wggggggggw.",
  "..wwwwwwww..",
  "............",
];

export const FLASK = FLASK_F1;
export const FLASK_FRAMES = [FLASK_F1, FLASK_F2];

/** Oscilloscope / Signal Wave: sine pulse scan */
const SCOPE_F1 = [
  ".kkkkkkkkkk.",
  ".kcccccccck.",
  ".kc......ck.",
  ".kc......ck.",
  ".kc..gg..ck.",
  ".kcg.gg.gck.",
  ".kc.g..g.ck.",
  ".kc......ck.",
  ".kc......ck.",
  ".kcccccccck.",
  ".kkkkkkkkkk.",
  "....k..k....",
];

const SCOPE_F2 = [
  ".kkkkkkkkkk.",
  ".kcccccccck.",
  ".kc......ck.",
  ".kc.gg...ck.",
  ".kcg..g..ck.",
  ".kc....g.ck.",
  ".kc.....gck.",
  ".kc......ck.",
  ".kc......ck.",
  ".kcccccccck.",
  ".kkkkkkkkkk.",
  "....k..k....",
];

export const OSCILLOSCOPE = SCOPE_F1;
export const OSCILLOSCOPE_FRAMES = [SCOPE_F1, SCOPE_F2];

/** Caliper / Precision Gauge: micrometer jaws */
export const CALIPER = [
  "wwwwwwwwwwww",
  "wkkkkkkkkkkw",
  "wk...k....kw",
  "wk...k....kw",
  "wk...k....kw",
  "wk...w....kw",
  "wk........kw",
  "wkkkkkkkkkkw",
  "............",
  "............",
  "............",
  "............",
];

/** Precision Balance Scale */
export const BALANCE = [
  ".....yy.....",
  "....yyyy....",
  "y...yyyy...y",
  "yy..yyyy..yy",
  "yyyy.yy.yyyy",
  ".yy..yy..yy.",
  ".....yy.....",
  ".....yy.....",
  ".....yy.....",
  ".....yy.....",
  "...yyyyyy...",
  "..yyyyyyyy..",
];

/** Sparkle / Precision Indicator */
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

/** Trophy: golden benchmark */
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

/** Multi-frame animation table for AnimatedSprite. */
export const SPRITE_FRAMES = {
  scientist: { frames: [SCIENTIST_OPEN, SCIENTIST_BLINK, SCIENTIST_OPEN, SCIENTIST_OPEN], fps: 1.2 },
  flask: { frames: FLASK_FRAMES, fps: 2 },
  oscilloscope: { frames: OSCILLOSCOPE_FRAMES, fps: 2.5 },
  sparkle: { frames: SPARKLE_FRAMES, fps: 2.2 },
} as const;

export type AnimatedSpriteName = keyof typeof SPRITE_FRAMES;

/** Shared laboratory palettes */
export const PALETTES = {
  scientist: { w: "#f1f4ff", k: "#101830", c: "#5fe3c3" } satisfies Palette,
  flask: { w: "#dfe7ff", g: "#5fe3a1", y: "#ffcf5c" } satisfies Palette,
  oscilloscope: { k: "#0a1022", c: "#202e52", g: "#5fe3c3" } satisfies Palette,
  caliper: { w: "#8ab4ff", k: "#151e36" } satisfies Palette,
  balance: { y: "#ffcf5c" } satisfies Palette,
  trophy: { y: "#ffd75c", o: "#c9953a" } satisfies Palette,
  sparkle: { w: "#dfe7ff", X: "#5fe3c3" } satisfies Palette,
  star: { w: "#dfe7ff", X: "#8ab4ff" } satisfies Palette,
  starWarm: { w: "#ffe9a3", X: "#ffcf5c" } satisfies Palette,
  starMint: { w: "#b9ffe8", X: "#5fe3c3" } satisfies Palette,
  gauge: { w: "#8ab4ff", g: "#5fe3a1", r: "#ff7d8a", k: "#0b1226" } satisfies Palette,
  ghost: { p: "#5a647f", l: "#4a5470", k: "#202e52" } satisfies Palette,
} as const;

export const CONFETTI_COLORS = ["#5fe3c3", "#5fe3a1", "#8ab4ff", "#b48cff", "#ffcf5c", "#f1f4ff"];
