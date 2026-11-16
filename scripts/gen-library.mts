/**
 * Generates the 60-day estimation library (300 prompts):
 *   64 direct facts + 180 calculations (60 families × 3) + 56 target matches.
 * Every puzzle is validated with the real validator before anything is written.
 *
 * Run: npx tsx scripts/gen-library.mts
 */

import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { calcPrompt, directPrompt, targetPrompt } from "./lib/content-gen/helpers.mts";
import { DIRECTS } from "./lib/content-gen/directs.mts";
import { DATASETS, TARGETS } from "./lib/content-gen/datasets.mts";
import { GROUPS1 } from "./lib/content-gen/calcs1.mts";
import { GROUPS2 } from "./lib/content-gen/calcs2.mts";
import { GROUPS3 } from "./lib/content-gen/calcs3.mts";
import { GROUPS4 } from "./lib/content-gen/calcs4.mts";
import { validatePuzzle, type DatasetIndex } from "@/lib/content/validate";
import type { EditorialPuzzle, EditorialPrompt } from "@/lib/content/types";

const START_DATE = "2026-11-16";
const THEME_TAGS = [
  "orders of magnitude",
  "everyday arithmetic",
  "unit conversions",
  "fermi classics",
  "household math",
  "money and rates",
  "scale and distance",
];

const groups = [...GROUPS1, ...GROUPS2, ...GROUPS3, ...GROUPS4];
if (groups.length !== 60) throw new Error(`Expected 60 calc families, got ${groups.length}`);
for (const g of groups) {
  if (g.variants.length !== 3) throw new Error(`Family ${g.id} has ${g.variants.length} variants (need 3)`);
}

// Interleaved variant order: v0 of every family, then v1, then v2, so a daily
// gets three different families and each family's variants spread across days.
const byVariant = (v: number) => groups.map((g) => calcPrompt(g.id, g.category, g.variants[v]));
const cals = [...byVariant(0), ...byVariant(1), ...byVariant(2)];
if (cals.length !== 180) throw new Error(`Expected 180 calculations, got ${cals.length}`);

const directs = DIRECTS.map(directPrompt);
if (directs.length !== 64) throw new Error(`Expected 64 direct facts, got ${directs.length}`);

const targets = TARGETS.map(targetPrompt);
if (targets.length !== 56) throw new Error(`Expected 56 targets, got ${targets.length}`);

function addDays(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

const puzzles: EditorialPuzzle[] = [];
for (let i = 0; i < 60; i++) {
  const day = addDays(START_DATE, i);
  const slot2 = cals[i];
  const slot3 = cals[60 + ((i + 20) % 60)];
  const slot4 = cals[120 + ((i + 40) % 60)];
  const prompts: EditorialPrompt[] =
    i < 56
      ? [directs[i], slot2, slot3, slot4, targets[i]]
      : [directs[i], slot2, slot3, slot4, directs[60 + (i - 56)]];
  puzzles.push({
    kind: "estimation_puzzle",
    game: "estimation",
    date: day,
    themeTag: THEME_TAGS[i % THEME_TAGS.length],
    quality: "live",
    prompts,
  });
}

// Validate everything with the game's own validator before writing a byte.
const index: DatasetIndex = new Map(DATASETS.map((d) => [d.id, d]));
let failed = 0;
for (const pz of puzzles) {
  const result = validatePuzzle(pz, index);
  if (!result.ok) {
    failed++;
    console.error(`✗ ${pz.date}`);
    for (const issue of result.issues) console.error(`   [${issue.promptId ?? "-"}] ${issue.field}: ${issue.message}`);
  }
}
if (failed > 0) throw new Error(`${failed} puzzles failed validation`);

// Prompt-id uniqueness across the whole library.
const seen = new Map<string, number>();
for (const pz of puzzles) for (const p of pz.prompts) seen.set(p.promptId, (seen.get(p.promptId) ?? 0) + 1);
const dupes = [...seen.entries()].filter(([, n]) => n > 1);
if (dupes.length > 0) throw new Error(`Duplicate promptIds: ${dupes.map(([id]) => id).join(", ")}`);

// Write one file per dataset and per puzzle (the importer picks files by `kind`).
const outDir = path.join(process.cwd(), "content", "live");
const dsDir = path.join(outDir, "datasets");
const dayDir = path.join(outDir, "days");
mkdirSync(dsDir, { recursive: true });
mkdirSync(dayDir, { recursive: true });
for (const ds of DATASETS) {
  writeFileSync(path.join(dsDir, `${ds.id}.json`), JSON.stringify(ds, null, 2) + "\n");
}
for (const pz of puzzles) {
  writeFileSync(path.join(dayDir, `${pz.date}.json`), JSON.stringify(pz, null, 2) + "\n");
}
console.log(`Wrote ${puzzles.length} puzzles (${puzzles.length * 5} prompts) + ${DATASETS.length} datasets to content/live/`);
const hintCount = puzzles.flatMap((p) => p.prompts).filter((p) => p.hint).length;
const withHints = puzzles.flatMap((p) => p.prompts).filter((p) => p.roundType === "calculation" && p.hint).length;
console.log(`Hints: ${hintCount} total (${withHints} of 180 calculations)`);
