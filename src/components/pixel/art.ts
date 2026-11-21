/**
 * Roughly Right pixel art, second edition.
 *
 * Rules for every sprite here: a 1px dark outline (`k`) around the
 * silhouette, a light source from the top-left (highlights top-left, shade
 * bottom-right), and at most 5 colours per sprite drawn from the shared
 * palette below. Rows are strings; "." is transparent.
 */

export type Palette = Record<string, string>;
export type Frames = string[][];

/** Shared master palette (sprites pick from these). */
export const C = {
  ink: "#16112b",
  inkSoft: "#2a2350",
  plum: "#7656b8",
  plumDark: "#55408c",
  plumLight: "#a98be0",
  cream: "#f6e8c8",
  creamDark: "#d2b98c",
  white: "#fffaf0",
  gold: "#ffd447",
  goldDark: "#d08f1f",
  goldLight: "#fff3b0",
  orange: "#ff8a3d",
  orangeDark: "#e0602b",
  mint: "#5ee6a8",
  mintDark: "#2f9e75",
  sky: "#6fb6ff",
  skyDark: "#3d74c9",
  rose: "#ff6b81",
  roseDark: "#c9405a",
  steel: "#c9d2ef",
  steelDark: "#8b96bf",
  blush: "#ff9fb2",
};

// ---------------------------------------------------------------------------
// Mascot: Rho the owl (16x16). Expressions swap the eye rows.
// ---------------------------------------------------------------------------

const OWL_TOP = [
  "................",
  "..kk........kk..",
  "..khk......khk..",
  "..khbkkkkkkbhk..",
  ".khbbbbbbbbbbhk.",
];
const OWL_BOTTOM = [
  "kBbllllOOllllbBk",
  "kBllLllllllLllBk",
  "kBlllLllllLlllBk",
  ".kBllllllllllBk.",
  ".kBBllllllllBBk.",
  "..kkkoookkoookk.",
  "................",
];
const owl = (eyes: string[]) => [...OWL_TOP, ...eyes, ...OWL_BOTTOM];

const EYES = {
  idle: [".kbwwwwbbwwwwbk.", "kbbwpWwbbwpWwbbk", "kbbwppwbbwppwbbk", "kbbbwwboobwwbbbk"],
  blink: [".kbbbbbbbbbbbbk.", "kbbbbbbbbbbbbbbk", "kbbkkkkbbkkkkbbk", "kbbbbbboobbbbbbk"],
  look: [".kbwwwwbbwwwwbk.", "kbbwwpWbbwwpWbbk", "kbbwwppbbwwppbbk", "kbbbwwboobwwbbbk"],
  think: [".kbwwwwbbwwwwbk.", "kbbwwppbbwwppbbk", "kbbwwwwbbwwwwbbk", "kbbbwwboobwwbbbk"],
  happy: [".kbbbbbbbbbbbbk.", "kbbbbkbbbbkbbbbk", "kbbbkbkbbkbkbbbk", "kbrrbbboobbbrrbk"],
  star: [".kbwwwwbbwwwwbk.", "kbbwyywbbwyywbbk", "kbbwyywbbwyywbbk", "kbrrwwboobwwrrbk"],
  sad: [".kbbbbbbbbbbbbk.", "kbbkkkkbbkkkkbbk", "kbbwppwbbwppwbbk", "kbbbwwboobwwbbbk"],
};

export const OWL = {
  idle: owl(EYES.idle),
  blink: owl(EYES.blink),
  look: owl(EYES.look),
  think: owl(EYES.think),
  happy: owl(EYES.happy),
  star: owl(EYES.star),
  sad: owl(EYES.sad),
};

export const OWL_PALETTE: Palette = {
  k: C.ink,
  h: C.plumLight,
  b: C.plum,
  B: C.plumDark,
  l: C.cream,
  L: C.creamDark,
  w: C.white,
  W: "#ffffff",
  p: C.ink,
  o: C.orange,
  O: C.orangeDark,
  r: C.blush,
  y: C.gold,
};

export type OwlMood = "idle" | "think" | "happy" | "star" | "sad";

/** Frame loops per mood (played by PixelAnim). */
export const OWL_LOOPS: Record<OwlMood, { frames: Frames; fps: number }> = {
  idle: { frames: [OWL.idle, OWL.idle, OWL.idle, OWL.blink, OWL.idle, OWL.look, OWL.look, OWL.idle], fps: 2 },
  think: { frames: [OWL.think, OWL.think, OWL.think, OWL.blink], fps: 2 },
  happy: { frames: [OWL.happy, OWL.happy, OWL.idle, OWL.happy], fps: 3 },
  star: { frames: [OWL.star, OWL.happy], fps: 4 },
  sad: { frames: [OWL.sad, OWL.sad, OWL.sad, OWL.blink], fps: 1.5 },
};

// ---------------------------------------------------------------------------
// Round-type icons (12x12)
// ---------------------------------------------------------------------------

export const RULER = [
  "............",
  "............",
  "............",
  "kkkkkkkkkkkk",
  "kwykyykyykyk",
  "kyykyyyyykyk",
  "kyyyyyyyyyyk",
  "kYYYYYYYYYYk",
  "kkkkkkkkkkkk",
  "............",
  "............",
  "............",
];
export const RULER_PALETTE: Palette = { k: C.ink, y: C.gold, Y: C.goldDark, w: C.goldLight };

export const CALC = [
  "..kkkkkkkk..",
  ".kssssssssk.",
  ".ksggggggsk.",
  ".ksgdgddgsk.",
  ".ksggggggsk.",
  ".kssssssssk.",
  ".kswswswosk.",
  ".kssssssssk.",
  ".kswswswosk.",
  ".kssssssssk.",
  ".kswswswosk.",
  "..kkkkkkkk..",
];
export const CALC_PALETTE: Palette = { k: C.ink, s: "#3b4372", g: "#1d4a3a", d: "#8dffc4", w: C.steel, o: C.orange };

export const TARGET = [
  "....kkkk....",
  "..kkrrrrkk..",
  ".krrwwwwrrk.",
  ".krwwrrwwrk.",
  "krwwrrrrwwRk",
  "krwrryyrrwRk",
  "krwrryyrrwRk",
  "krwwrrrrwwRk",
  ".krwwrrwwRk.",
  ".kRRwwwwRRk.",
  "..kkRRRRkk..",
  "....kkkk....",
];
export const TARGET_PALETTE: Palette = { k: C.ink, r: C.rose, R: C.roseDark, w: C.white, y: C.gold };

export const SIGNAL_METER = [
  "................",
  "..........kkkk..",
  "..........kgDk..",
  "..........kgDk..",
  ".......kkkkgDk..",
  ".......kgDkgDk..",
  ".......kgDkgDk..",
  "....kkkkgDkgDk..",
  "....kyDkgDkgDk..",
  "....kyDkgDkgDk..",
  ".kkkkyDkgDkgDk..",
  ".kyDkyDkgDkgDk..",
  ".kyDkyDkgDkgDk..",
  ".kkkkkkkkkkkkk..",
  "................",
  "................",
];
export const SIGNAL_PALETTE: Palette = {
  k: C.ink,
  y: C.goldLight,
  g: C.mint,
  D: C.mintDark,
};

// ---------------------------------------------------------------------------
// Rewards and status
// ---------------------------------------------------------------------------

const FLAME_BODY = [
  "...koyyyok..",
  "..koyywyyok.",
  "..koywwwyok.",
  ".koyywwwyyok",
  ".koywwwwwyok",
  ".kooywwwyook",
  "..kooyyyook.",
  "...kkkkkkk..",
];
export const FLAME_FRAMES: Frames = [
  ["......k.....", ".....kok....", ".....koyk...", "....koyyk...", ...FLAME_BODY],
  [".....k......", "....kok.....", "....koyk....", "....koyyk...", ...FLAME_BODY],
  [".......k....", "......kok...", ".....kyok...", "....kyyok...", ...FLAME_BODY],
];
export const FLAME_PALETTE: Palette = { k: "#3a1405", o: "#ff5f2e", y: "#ffb02e", w: "#fff1a8" };

const trophy = (glintCol: number): string[] => {
  const base = [
    "..kkkkkkkk..",
    ".kyyyyyyyyk.",
    ".kyyyyyyyok.",
    ".kyyyyyyyok.",
    "..kyyyyyok..",
    "...kyyyok...",
    "....kyok....",
    "....kook....",
    "...kyyyok...",
    "..kkkkkkkk..",
    "..koooooook.",
    "..kkkkkkkk..",
  ];
  return base.map((row, y) =>
    y >= 1 && y <= 3 && row[glintCol - (y - 1)] === "y"
      ? row.slice(0, glintCol - (y - 1)) + "w" + row.slice(glintCol - (y - 1) + 1)
      : row,
  );
};
export const TROPHY = trophy(3);
export const TROPHY_FRAMES: Frames = [trophy(3), trophy(5), trophy(7), trophy(9), trophy(3), trophy(3)];
export const TROPHY_PALETTE: Palette = { k: "#3b2606", y: C.gold, o: C.goldDark, w: C.goldLight };

export const MEDAL = [
  ".kkk....kkk.",
  ".krrk..kbbk.",
  "..krrkkbbk..",
  "...krrbbk...",
  "...kkkkkk...",
  "..kyyyyyyk..",
  ".kyywyyyyok.",
  ".kywyyyyyok.",
  ".kyyyyyyyok.",
  ".kyyyyyyook.",
  "..kooooook..",
  "...kkkkkk...",
];
export const MEDAL_PALETTE: Palette = { k: C.ink, r: C.rose, b: C.sky, y: C.gold, o: C.goldDark, w: C.goldLight };

export const HOURGLASS = [
  ".kkkkkkkkkk.",
  ".kooooooook.",
  "..kggggggk..",
  "..kgyyyygk..",
  "...kgyygk...",
  "....kyyk....",
  "....kgyk....",
  "...kggygk...",
  "..kgyyyygk..",
  "..kyyyyyyk..",
  ".kooooooook.",
  ".kkkkkkkkkk.",
];
export const HOURGLASS_PALETTE: Palette = { k: C.ink, o: "#a0612a", g: "#bfe4ff", y: C.gold };

export const GHOST = [
  "...kkkkkk...",
  "..kwwwwwwk..",
  ".kwwwwwwwsk.",
  ".kwkkwwkkwsk",
  ".kwkkwwkkwsk",
  ".kwwwwwwwwsk",
  ".kwwwkkwwwsk",
  ".kwwwwwwwwsk",
  ".kwwwwwwwssk",
  ".kwkkwwkkssk",
  ".kk..kk..kk.",
  "............",
];
export const GHOST_PALETTE: Palette = { k: C.ink, w: C.steel, s: C.steelDark };

export const GEM = [
  "............",
  "...kkkkkk...",
  "..kwccccCk..",
  ".kwcwccCCCk.",
  "kkkkkkkkkkkk",
  ".kcwcccCCCk.",
  "..kcwccCCk..",
  "...kcwcCk...",
  "....kcCk....",
  ".....kk.....",
  "............",
  "............",
];
export const GEM_PALETTE: Palette = { k: C.ink, w: "#e6fbff", c: "#59d6ff", C: "#2f8fc9" };

export const LOCK = [
  "............",
  "....ssss....",
  "...s....s...",
  "...s....s...",
  "...s....s...",
  ".kkkkkkkkkk.",
  ".kyyyyyyyyk.",
  ".kywykkyyok.",
  ".kyyykkyyok.",
  ".kyyyykyyok.",
  ".kooooooook.",
  ".kkkkkkkkkk.",
];
export const LOCK_PALETTE: Palette = { k: C.ink, s: C.steelDark, y: C.gold, o: C.goldDark, w: C.goldLight };

export const CALENDAR = [
  "...k....k...",
  ".kkrkkkkrkk.",
  ".krrrrrrrrk.",
  ".kkkkkkkkkk.",
  ".kwwwwwwwwk.",
  ".kwkwkwkwwk.",
  ".kwwwwwwwwk.",
  ".kwkwkwkwwk.",
  ".kwwwwwwwwk.",
  ".kwkwkwbbwk.",
  ".kwwwwwbbwk.",
  ".kkkkkkkkkk.",
];
export const CALENDAR_PALETTE: Palette = { k: C.ink, r: C.rose, w: C.cream, b: C.mint };

export const CHART = [
  "............",
  "........kkk.",
  "........kgk.",
  "....kkk.kgk.",
  "....kbk.kgk.",
  "kkk.kbk.kgk.",
  "kyk.kbk.kgk.",
  "kyk.kbk.kgk.",
  "kyk.kbk.kgk.",
  "kkkkkkkkkkk.",
  "............",
  "............",
];
export const CHART_PALETTE: Palette = { k: C.ink, y: C.gold, b: C.sky, g: C.mint };

export const DICE = [
  "............",
  ".kkkkkkkkkk.",
  ".kwwwwwwwsk.",
  ".kwkwwwwwsk.",
  ".kwwwwwwwsk.",
  ".kwwwkwwwsk.",
  ".kwwwwwwwsk.",
  ".kwwwwwkwsk.",
  ".kwwwwwwwsk.",
  ".kssssssssk.",
  ".kkkkkkkkkk.",
  "............",
];
export const DICE_PALETTE: Palette = { k: C.ink, w: C.white, s: C.creamDark };

export const SPARK_FRAMES: Frames = [
  [".......", "...w...", "..wXw..", ".wXXXw.", "..wXw..", "...w...", "......."],
  ["...w...", "...w...", "..wXw..", "wwXXXww", "..wXw..", "...w...", "...w..."],
  [".......", ".......", "...w...", "..wXw..", "...w...", ".......", "......."],
];
export const SPARK_PALETTE: Palette = { w: C.goldLight, X: C.gold };

export const HEART = [
  "............",
  ".kkk...kkk..",
  "kwrrk.krrrk.",
  "kwrrrkrrrRk.",
  "krrrrrrrrRk.",
  ".krrrrrrRk..",
  "..krrrrRk...",
  "...krrRk....",
  "....kRk.....",
  ".....k......",
  "............",
  "............",
];
export const HEART_PALETTE: Palette = { k: C.ink, w: "#ffd1da", r: C.rose, R: C.roseDark };

/** Theme swatches for the cosmetic picker (sky top, sky bottom, accent). */
export const THEME_SWATCHES: Record<string, [string, string, string]> = {
  night: ["#0d0b24", "#1d1846", "#ffd447"],
  dawn: ["#2a1840", "#c76b6b", "#ffcf7a"],
  aurora: ["#061a24", "#0f3d4a", "#5ee6a8"],
  ember: ["#1a0b0b", "#4a1a12", "#ff8a3d"],
};
