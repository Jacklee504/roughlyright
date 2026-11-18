/**
 * Generates social/OG and PWA icon PNGs from the game's own pixel-art language:
 * dark observatory background, starfield, the 5x7 pixel font, and sprites from
 * src/components/pixel/sprites.ts. Deterministic — safe to re-run in CI.
 *
 *   npx tsx scripts/og-image.mts
 *
 * Outputs: public/og.png (1200x630), public/icon-512.png, public/icon-192.png
 */
import { writeFileSync } from "node:fs";
import { deflateSync } from "node:zlib";
import { FLASK, TROPHY, PALETTES } from "../src/components/pixel/sprites";
import path from "node:path";

/* ------------------------------------------------------------------ PNG */

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(buf: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type: string, data: Uint8Array): Buffer {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, "ascii"), Buffer.from(data)]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

/** Encode RGBA pixels (w*h*4 bytes) as a PNG. */
function encodePng(w: number, h: number, rgba: Uint8Array): Buffer {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  const raw = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) {
    raw[y * (w * 4 + 1)] = 0; // filter: none
    Buffer.from(rgba.buffer, rgba.byteOffset + y * w * 4, w * 4).copy(raw, y * (w * 4 + 1) + 1);
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", new Uint8Array(0)),
  ]);
}

/* ---------------------------------------------------------------- canvas */

type RGB = [number, number, number];

class Canvas {
  data: Uint8Array;
  constructor(public w: number, public h: number, public bg: RGB) {
    this.data = new Uint8Array(w * h * 4);
    for (let i = 0; i < w * h; i++) this.set(i % w, Math.floor(i / w), bg);
  }
  set(x: number, y: number, [r, g, b]: RGB, a = 255): void {
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
    const i = (y * this.w + x) * 4;
    this.data[i] = r;
    this.data[i + 1] = g;
    this.data[i + 2] = b;
    this.data[i + 3] = a;
  }
  /** Blend a rect of solid colour. */
  rect(x: number, y: number, w: number, h: number, c: RGB): void {
    for (let dy = 0; dy < h; dy++) for (let dx = 0; dx < w; dx++) this.set(x + dx, y + dy, c);
  }
}

function hex(c: string): RGB {
  const n = parseInt(c.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/* ------------------------------------------------------------------ font */

// 5x7 pixel font (uppercase + digits + a few marks).
const FONT: Record<string, string[]> = {
  A: [".###.", "#...#", "#...#", "#####", "#...#", "#...#", "#...#"],
  B: ["####.", "#...#", "#...#", "####.", "#...#", "#...#", "####."],
  C: [".###.", "#...#", "#....", "#....", "#....", "#...#", ".###."],
  D: ["####.", "#...#", "#...#", "#...#", "#...#", "#...#", "####."],
  E: ["#####", "#....", "#....", "####.", "#....", "#....", "#####"],
  F: ["#####", "#....", "#....", "####.", "#....", "#....", "#...."],
  G: [".###.", "#...#", "#....", "#..##", "#...#", "#...#", ".###."],
  H: ["#...#", "#...#", "#...#", "#####", "#...#", "#...#", "#...#"],
  I: [".###.", "..#..", "..#..", "..#..", "..#..", "..#..", ".###."],
  J: ["..###", "...#.", "...#.", "...#.", "...#.", "#..#.", ".##.."],
  K: ["#...#", "#..#.", "#.#..", "##...", "#.#..", "#..#.", "#...#"],
  L: ["#....", "#....", "#....", "#....", "#....", "#....", "#####"],
  M: ["#...#", "##.##", "#.#.#", "#.#.#", "#...#", "#...#", "#...#"],
  N: ["#...#", "##..#", "#.#.#", "#..##", "#...#", "#...#", "#...#"],
  O: [".###.", "#...#", "#...#", "#...#", "#...#", "#...#", ".###."],
  P: ["####.", "#...#", "#...#", "####.", "#....", "#....", "#...."],
  Q: [".###.", "#...#", "#...#", "#...#", "#.#.#", "#..#.", ".##.#"],
  R: ["####.", "#...#", "#...#", "####.", "#.#..", "#..#.", "#...#"],
  S: [".####", "#....", "#....", ".###.", "....#", "....#", "####."],
  T: ["#####", "..#..", "..#..", "..#..", "..#..", "..#..", "..#.."],
  U: ["#...#", "#...#", "#...#", "#...#", "#...#", "#...#", ".###."],
  V: ["#...#", "#...#", "#...#", "#...#", "#...#", ".#.#.", "..#.."],
  W: ["#...#", "#...#", "#...#", "#.#.#", "#.#.#", "##.##", "#...#"],
  X: ["#...#", "#...#", ".#.#.", "..#..", ".#.#.", "#...#", "#...#"],
  Y: ["#...#", "#...#", ".#.#.", "..#..", "..#..", "..#..", "..#.."],
  Z: ["#####", "....#", "...#.", "..#..", ".#...", "#....", "#####"],
  "0": [".###.", "#...#", "#..##", "#.#.#", "##..#", "#...#", ".###."],
  "1": ["..#..", ".##..", "..#..", "..#..", "..#..", "..#..", ".###."],
  "2": [".###.", "#...#", "....#", "...#.", "..#..", ".#...", "#####"],
  "3": ["####.", "....#", "....#", ".###.", "....#", "....#", "####."],
  "4": ["...#.", "..##.", ".#.#.", "#..#.", "#####", "...#.", "...#."],
  "5": ["#####", "#....", "#....", "####.", "....#", "....#", "####."],
  "6": ["..##.", ".#...", "#....", "####.", "#...#", "#...#", ".###."],
  "7": ["#####", "....#", "...#.", "..#..", ".#...", ".#...", ".#..."],
  "8": [".###.", "#...#", "#...#", ".###.", "#...#", "#...#", ".###."],
  "9": [".###.", "#...#", "#...#", ".####", "....#", "...#.", ".##.."],
  " ": [".....", ".....", ".....", ".....", ".....", ".....", "....."],
  "·": [".....", ".....", ".....", "..#..", ".....", ".....", "....."],
  "-": [".....", ".....", ".....", "####.", ".....", ".....", "....."],
  "/": ["....#", "...#.", "...#.", "..#..", ".#...", ".#...", "#...."],
};

function drawText(
  c: Canvas,
  text: string,
  cx: number,
  y: number,
  scale: number,
  color: RGB,
): number {
  const glyphW = 6 * scale; // 5 px + 1 px tracking
  const total = text.length * glyphW - scale;
  let x = Math.round(cx - total / 2);
  for (const ch of text.toUpperCase()) {
    const rows = FONT[ch] ?? FONT["·"];
    for (let r = 0; r < 7; r++)
      for (let col = 0; col < 5; col++)
        if (rows[r][col] === "#") c.rect(x + col * scale, y + r * scale, scale, scale, color);
    x += glyphW;
  }
  return total;
}

/** Rasterize a sprites.ts grid (palette letters) at the given scale/origin. */
function drawSprite(c: Canvas, sprite: string[], palette: Record<string, string>, ox: number, oy: number, s: number): void {
  sprite.forEach((row, r) => {
    row.split("").forEach((ch, col) => {
      const cs = palette[ch];
      if (!cs) return;
      c.rect(ox + col * s, oy + r * s, s, s, hex(cs));
    });
  });
}

/* --------------------------------------------------------- deterministic */

function mulberry(seed: number): () => number {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* ------------------------------------------------------------------- art */

const BG = hex("#060a17");
const MINT = hex("#5fe3c3");
const PERIWINKLE = hex("#8ab4ff");
const LAVENDER = hex("#b48cff");
const PALE = hex("#f1f4ff");
const DIM = hex("#3a4468");

function drawSky(c: Canvas, seed: number, n: number): void {
  const rnd = mulberry(seed);
  const stars = [PALE, PERIWINKLE, MINT, LAVENDER];
  for (let i = 0; i < n; i++) {
    const x = Math.floor(rnd() * c.w);
    const y = Math.floor(rnd() * c.h);
    const col = stars[Math.floor(rnd() * stars.length)];
    if (rnd() < 0.12) c.rect(x, y, 2, 2, col);
    else c.set(x, y, col, 235);
  }
}

function drawOg(): Buffer {
  const W = 1200;
  const H = 630;
  const c = new Canvas(W, H, BG);

  // Deep-space vignette: a few soft bands at the bottom for depth.
  c.rect(0, H - 6, W, 6, hex("#0b1226"));
  drawSky(c, 20261117, 240);

  // Sprites flanking the title, clear of the centered text stack.
  drawSprite(c, SCIENTIST_ART, PALETTES.scientist as unknown as Record<string, string>, 36, 224, 6);
  drawSprite(c, FLASK, PALETTES.flask as unknown as Record<string, string>, W - 36 - 12 * 6, 224, 6);
  drawSprite(c, TROPHY, PALETTES.trophy as unknown as Record<string, string>, W - 60 - 12 * 5, 420, 5);

  // Pixel rules + title stack.
  for (const x of [0, W - 64]) for (let i = 0; i < 64; i += 2) c.rect(x + i, 118, 2, 2, DIM);
  drawText(c, "· A DAILY ESTIMATION GAME ·", W / 2, 140, 3, PERIWINKLE);
  drawText(c, "ROUGHLY RIGHT", W / 2, 230, 12, MINT);
  drawText(c, "FIVE REAL-WORLD ESTIMATES", W / 2, 360, 4, PALE);
  drawText(c, "SCORED /500 - NEW PUZZLE AT 00:00 UTC", W / 2, 410, 4, PERIWINKLE);
  for (const x of [0, W - 64]) for (let i = 0; i < 64; i += 2) c.rect(x + i, 500, 2, 2, DIM);
  // Show the canonical domain when the owner sets it; stay generic otherwise.
  const site = (process.env.NEXT_PUBLIC_SITE_URL ?? "").replace(/^https?:\/\//, "").replace(/\/$/, "");
  drawText(c, site || "NO TIMER - NO SIGNUP - FREE TO PLAY", W / 2, 540, 3, DIM);

  return encodePng(W, H, c.data);
}

const SCIENTIST_ART: string[] = [
  "...wwwwww...",
  "..wwwwwwww..",
  ".wwwwwwwwww.",
  ".wccccccccw.",
  ".wccccccccw.",
  ".wcckcckccw.",
  ".wccccccccw.",
  ".wwkkkkkkww.",
  "..wwwwwwww..",
  ".wwwwwwwwww.",
  ".wwccccccww.",
  ".wwccccccww.",
];

function drawIcon(size: number): Buffer {
  const c = new Canvas(size, size, BG);
  drawSky(c, 777, Math.round(size * 0.16));
  const s = Math.floor(size / 16); // 12-wide sprite with 2-unit margin
  drawSprite(c, FLASK, PALETTES.flask as unknown as Record<string, string>, Math.floor((size - 12 * s) / 2), Math.floor((size - 12 * s) / 2), s);
  // Rounded-corner mask: shave the four corners into stepped blocks
  // (erase blocks where i + j < blocks, mirrored into each corner).
  const blocks = 4;
  const bs = Math.floor(size / 8);
  for (let i = 0; i < blocks; i++) {
    for (let j = 0; j < blocks - i; j++) {
      c.rect(i * bs, j * bs, bs, bs, BG); // top-left
      c.rect(size - (i + 1) * bs, j * bs, bs, bs, BG); // top-right
      c.rect(i * bs, size - (j + 1) * bs, bs, bs, BG); // bottom-left
      c.rect(size - (i + 1) * bs, size - (j + 1) * bs, bs, bs, BG); // bottom-right
    }
  }
  return encodePng(size, size, c.data);
}

const out = path.join(process.cwd(), "public");
writeFileSync(path.join(out, "og.png"), drawOg());
writeFileSync(path.join(out, "icon-512.png"), drawIcon(512));
writeFileSync(path.join(out, "icon-192.png"), drawIcon(192));
console.log("wrote public/og.png, public/icon-512.png, public/icon-192.png");
