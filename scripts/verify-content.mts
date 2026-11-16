/**
 * Content verification: re-validates every file under content/live with the
 * real validator, then cross-checks each calculation's final step against the
 * exactly recomputed published benchmark. Exits non-zero on any mismatch.
 *
 * Run: npx tsx scripts/verify-content.mts
 */

import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { fmt } from "./lib/content-gen/helpers.mts";
import { evaluateExpression } from "@/lib/domain/expression";
import { parseDecimalToRat } from "@/lib/domain/decimal";
import { editorialRound, validatePuzzle, validateDataset, type DatasetIndex } from "@/lib/content/validate";
import type { EditorialDataset, EditorialPuzzle } from "@/lib/content/types";

function walk(dir: string): string[] {
  const out: string[] = [];
  if (!statSync(dir, { throwIfNoEntry: false })) return out;
  for (const f of readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, f.name);
    if (f.isDirectory()) out.push(...walk(p));
    else if (f.name.endsWith(".json")) out.push(p);
  }
  return out;
}

const root = path.join(process.cwd(), "content", "live");
const files = walk(root);
const datasets: EditorialDataset[] = [];
const puzzles: EditorialPuzzle[] = [];
let metadataFiles = 0;
for (const f of files) {
  const json = JSON.parse(readFileSync(f, "utf8")) as { kind?: string };
  if (json.kind === "target_dataset") datasets.push(json as EditorialDataset);
  else if (json.kind === "estimation_puzzle") puzzles.push(json as EditorialPuzzle);
  else if (json.kind == null) metadataFiles++; // approvals.json and other release metadata
  else throw new Error(`Unexpected file: ${f} (kind ${json.kind})`);
}
if (files.length !== datasets.length + puzzles.length + metadataFiles) throw new Error("Unaccounted files");

let errors = 0;
const fail = (msg: string) => {
  errors++;
  console.error(`× ${msg}`);
};

// Datasets: full validation.
const index: DatasetIndex = new Map();
for (const ds of datasets) {
  const issues: { field: string; message: string }[] = [];
  if (!validateDataset(ds, issues)) {
    fail(`dataset ${ds.id}: ${issues.map((i) => `${i.field}: ${i.message}`).join("; ")}`);
  }
  index.set(ds.id, ds);
}

// Puzzles: full validation + invariants + benchmark cross-check.
let prompts = 0;
let calcPrompts = 0;
let targetPrompts = 0;
let directPrompts = 0;
let hintCount = 0;
for (const pz of puzzles) {
  const result = validatePuzzle(pz, index);
  if (!result.ok) fail(`${pz.date}: ${result.issues.map((i) => `[${i.promptId ?? "-"}] ${i.field}: ${i.message}`).join("; ")}`);

  prompts += pz.prompts.length;
  for (const p of pz.prompts) {
    if (p.hint) {
      hintCount++;
      if ("image" in (p.hint as object)) fail(`${p.promptId}: hint contains an image (policy: no images)`);
    }
    if (p.roundType === "direct_fact") {
      directPrompts++;
      if (p.hint) fail(`${p.promptId}: direct fact carries a hint (policy: none)`);
    }
    if (p.roundType === "calculation") {
      calcPrompts++;
      const s = p.scoring;
      if (s.type !== "calculation") throw new Error("unreachable");
      if (s.inputs.length < 2) fail(`${p.promptId}: fewer than two inputs`);
      const inputRats: Record<string, ReturnType<typeof parseDecimalToRat>> = {};
      for (const inp of s.inputs) inputRats[inp.name] = parseDecimalToRat(inp.value)!;
      const derived = evaluateExpression(s.formula, inputRats);
      if (!derived.ok) fail(`${p.promptId}: formula does not evaluate`);
      else {
        const published = editorialRound(derived.value, s.precision, s.roundTo);
        const last = s.steps[s.steps.length - 1] ?? "";
        if (!last.includes(published) || !last.startsWith("Worked estimate:")) {
          fail(`${p.promptId}: final step "${last}" does not match published benchmark ${published}`);
        }
        if (!last.includes(p.unit)) fail(`${p.promptId}: final step omits the unit "${p.unit}"`);
        if (s.steps.length < 2 || s.steps.length > 4) fail(`${p.promptId}: ${s.steps.length} steps (need 2–4)`);
      }
    }
    if (p.roundType === "target_match") targetPrompts++;
  }
}

// Schedule sanity: 60 consecutive dates starting 2026-11-16.
const dates = puzzles.map((p) => p.date).sort();
const expected: string[] = [];
{
  const d = new Date("2026-11-16T00:00:00Z");
  for (let i = 0; i < 60; i++) {
    expected.push(d.toISOString().slice(0, 10));
    d.setUTCDate(d.getUTCDate() + 1);
  }
}
if (dates.join(",") !== expected.join(",")) fail(`date schedule mismatch`);

const summary = {
  files: files.length,
  datasets: datasets.length,
  puzzles: puzzles.length,
  prompts,
  directPrompts,
  calcPrompts,
  targetPrompts,
  hintedPrompts: hintCount,
};
console.log("verify-content summary:", JSON.stringify(summary));
const mixOk = directPrompts === 64 && calcPrompts === 180 && targetPrompts === 56 && prompts === 300;
if (errors > 0) {
  console.error(`verify-content: ${errors} error(s)`);
  process.exit(1);
}
if (!mixOk) {
  console.error("verify-content: slot-mix totals off (expected 64 direct + 180 calc + 56 target = 300)");
  process.exit(1);
}
console.log("verify-content: OK");
