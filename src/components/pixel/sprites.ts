/**
 * Pixel-art sprites — hand-drawn text grids.
 *
 * Each sprite is an array of equal-length strings (square). Each character is
 * a palette key; "." is transparent. Rendered by PixelSprite as crisp SVG
 * rects (shape-rendering: crispEdges), so they scale cleanly and work in
 * server components with zero runtime cost.
 */

export type Palette = Record<string, string>;

export const ASTRONAUT = [
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

export const ROCKET = [
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
  ".....oo.....",
  ".....oo.....",
];

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

export const SPARKLE = [
  "...w...",
  "..wXw..",
  ".wXXXw.",
  "wXXXXXw",
  ".wXXXw.",
  "..wXw..",
  "...w...",
];

/** Shared palettes; a gray/ghost variant of any sprite reads as "inactive". */
export const PALETTES = {
  astronaut: { w: "#e8eeff", k: "#0d1430", y: "#8ab4ff" } satisfies Palette,
  rocket: { w: "#e8eeff", r: "#ff7d8a", y: "#ffcf5c", o: "#ff9d4d" } satisfies Palette,
  trophy: { y: "#ffd75c", o: "#c9953a" } satisfies Palette,
  flame: { o: "#ff9d4d", y: "#ffcf5c" } satisfies Palette,
  planet: { p: "#8f7bff", l: "#b48cff" } satisfies Palette,
  ghost: { p: "#5a647f", l: "#4a5470" } satisfies Palette,
  star: { w: "#dfe7ff", X: "#8ab4ff" } satisfies Palette,
  starWarm: { w: "#ffe9a3", X: "#ffcf5c" } satisfies Palette,
  starMint: { w: "#b9ffe8", X: "#5fe3c3" } satisfies Palette,
} as const;
