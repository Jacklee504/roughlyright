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

/** Flame: the streak marker. Two frames so the tip flickers mid-burn. */
const FLAME_F1 = [
  "............",
  ".....o......",
  "....oo......",
  "....oyo.....",
  "...oyyo.....",
  "...oyyyo....",
  "..oyywyyyo..",
  "..oyywwwyo..",
  "..oyywwwyo..",
  "...oywwyo...",
  "....oooo....",
  "............",
];
const FLAME_F2 = [
  "............",
  "......o.....",
  "......oo....",
  ".....oyo....",
  "....oyyo....",
  "...oyyyo....",
  "..oyywwyyo..",
  "..oyywwwyo..",
  "..oyywwwyo..",
  "...oywwyo...",
  "....oooo....",
  "............",
];
export const FLAME = FLAME_F1;
export const FLAME_FRAMES = [FLAME_F1, FLAME_F2];

/** Medal: personal-best marker (ribbon + gold disc). */
export const MEDAL = [
  "...rr...rr..",
  "..rrr..rrr..",
  "..rrr..rrr..",
  "...rr..rr...",
  "....rrrr....",
  "...yyyyyy...",
  "..yyoyyoyy..",
  "..yyoyyoyy..",
  "..yyyyyyyy..",
  "...yyyyyy...",
  "....o..o....",
  "............",
];

/** Hourglass: the finish window has closed. */
export const HOURGLASS = [
  "..oooooooo..",
  "..oyyyyyyo..",
  "..oyyyyyyo..",
  "...oyyyyo...",
  "....oyyo....",
  "....yooy....",
  "....yooy....",
  "...yoyyoy...",
  "..oyyyyyyo..",
  "..oyyyyyyo..",
  "..oooooooo..",
  "............",
];

/** Ghost: empty states and lost pages. */
export const GHOST = [
  "...pppppp...",
  "..pppppppp..",
  ".pppppppppp.",
  ".ppkppppkpp.",
  ".ppkppppkpp.",
  ".pppppppppp.",
  ".pppppppppp.",
  ".pppppppppp.",
  ".pppppppppp.",
  ".pppppppppp.",
  ".pp.pp.pp.p.",
  "............",
];

/** Trophy: the outlined second-edition trophy lives in art.ts; re-exported for older callers. */
import { TROPHY as ART_TROPHY, TROPHY_FRAMES as ART_TROPHY_FRAMES } from "./art";
export const TROPHY = ART_TROPHY;
export const TROPHY_FRAMES = ART_TROPHY_FRAMES;

/** Multi-frame animation table for AnimatedSprite. */
export const SPRITE_FRAMES = {
  scientist: { frames: [SCIENTIST_OPEN, SCIENTIST_BLINK, SCIENTIST_OPEN, SCIENTIST_OPEN], fps: 1.2 },
  flask: { frames: FLASK_FRAMES, fps: 2 },
  oscilloscope: { frames: OSCILLOSCOPE_FRAMES, fps: 2.5 },
  sparkle: { frames: SPARKLE_FRAMES, fps: 2.2 },
  flame: { frames: FLAME_FRAMES, fps: 6 },
  trophy: { frames: TROPHY_FRAMES, fps: 1.8 },
} as const;

export type AnimatedSpriteName = keyof typeof SPRITE_FRAMES;

/** Shared laboratory palettes */
export const PALETTES = {
  scientist: { w: "#f1f4ff", k: "#101830", c: "#5fe3c3" } satisfies Palette,
  flask: { w: "#dfe7ff", g: "#5fe3a1", y: "#ffcf5c" } satisfies Palette,
  oscilloscope: { k: "#0a1022", c: "#202e52", g: "#5fe3c3" } satisfies Palette,
  caliper: { w: "#8ab4ff", k: "#151e36" } satisfies Palette,
  balance: { y: "#ffcf5c" } satisfies Palette,
  trophy: { k: "#3b2606", y: "#ffd447", o: "#d08f1f", w: "#fff3b0" } satisfies Palette,
  sparkle: { w: "#dfe7ff", X: "#5fe3c3" } satisfies Palette,
  flame: { o: "#ff8a3d", y: "#ffcf5c", w: "#ffe9a3" } satisfies Palette,
  medal: { r: "#ff7d8a", y: "#ffd75c", o: "#c9953a" } satisfies Palette,
  hourglass: { o: "#c9953a", y: "#ffcf5c" } satisfies Palette,
  ghost: { p: "#c7d0ea", l: "#9aa7c7", k: "#101830" } satisfies Palette,
  star: { w: "#dfe7ff", X: "#8ab4ff" } satisfies Palette,
  starWarm: { w: "#ffe9a3", X: "#ffcf5c" } satisfies Palette,
  starMint: { w: "#b9ffe8", X: "#5fe3c3" } satisfies Palette,
  gauge: { w: "#8ab4ff", g: "#5fe3a1", r: "#ff7d8a", k: "#0b1226" } satisfies Palette,
} as const;

export const CONFETTI_COLORS = ["#5fe3c3", "#5fe3a1", "#8ab4ff", "#b48cff", "#ffcf5c", "#f1f4ff"];
