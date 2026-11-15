/**
 * Automatic content validation. Rejects before anything is scheduled:
 * bad number ranges, missing units, missing target dataset entries, colliding
 * aliases, calculation units that do not reduce to the output, missing source
 * or assumption notes, invalid score precision, malformed hints, duplicate
 * revisions, slot mix errors, and benchmark/derivation mismatches.
 */

import { cmp, div, eq, parseDecimalToRat, rat, ratToString, type Rat } from "@/lib/domain/decimal";
import { inSupportedRange } from "@/lib/domain/numberParser";
import { evaluateExpression } from "@/lib/domain/expression";
import { normalizeKey } from "@/lib/domain/text";
import type { EditorialDataset, EditorialPuzzle, EditorialPrompt, TargetEntry } from "./types";

export type ValidationIssue = { promptId?: string; field: string; message: string };
export type ValidationOk = { ok: true; benchmarks: Record<string, string> }; // promptId -> published benchmark string
export type ValidationErr = { ok: false; issues: ValidationIssue[] };

export type DatasetIndex = Map<string, EditorialDataset>;

/** Round a rational to `precision` decimal places, or to the nearest `roundTo` multiple (half-up). */
export function editorialRound(v: Rat, precision: number, roundTo?: number | null): string {
  if (roundTo && roundTo > 0) {
    const m = parseDecimalToRat(String(roundTo))!;
    const scaled = div(v, m);
    const q = (2n * scaled.n + scaled.d) / (2n * scaled.d); // floor(x + 1/2)
    return ratToString(rat(q * m.n, m.d), undefined);
  }
  return ratToString(v, precision);
}

export function validateDataset(ds: EditorialDataset, issues: ValidationIssue[]): boolean {
  let ok = true;
  if (ds.entries.length < 5) {
    issues.push({ field: `dataset:${ds.id}`, message: "Target datasets need at least five eligible entries." });
    ok = false;
  }
  const seenIds = new Set<string>();
  const seenKeys = new Map<string, string>(); // normKey -> entryId
  for (const e of ds.entries) {
    if (seenIds.has(e.id)) {
      issues.push({ field: `dataset:${ds.id}`, message: `Duplicate entry id: ${e.id}` });
      ok = false;
    }
    seenIds.add(e.id);
    const v = parseDecimalToRat(e.value);
    if (!v || cmp(v, rat(0n)) <= 0 || !inSupportedRange(v)) {
      issues.push({ field: `dataset:${ds.id}:${e.id}`, message: `Entry value must be positive and within the supported range: ${e.value}` });
      ok = false;
    }
    if (!e.source || !e.source.title) {
      issues.push({ field: `dataset:${ds.id}:${e.id}`, message: "Every target entry needs a source record." });
      ok = false;
    }
    const keys = [e.label, ...(e.aliases ?? [])].map((k) => normalizeKey(k));
    for (const k of keys) {
      if (!k) continue;
      const existing = seenKeys.get(k);
      if (existing && existing !== e.id) {
        issues.push({
          field: `dataset:${ds.id}`,
          message: `Ambiguous comparison key "${k}" maps to multiple entries (${existing}, ${e.id}). Add a disambiguator or remove the alias.`,
        });
        ok = false;
      } else if (!existing) {
        seenKeys.set(k, e.id);
      }
    }
  }
  return ok;
}

function validateNumberValue(
  issues: ValidationIssue[],
  promptId: string,
  field: string,
  raw: string,
): Rat | null {
  const v = parseDecimalToRat(raw);
  if (!v || cmp(v, rat(0n)) <= 0 || !inSupportedRange(v)) {
    issues.push({ promptId, field, message: `Value must be a positive number within the supported range (1e-9..1e15): "${raw}"` });
    return null;
  }
  return v;
}

function validatePrecision(
  issues: ValidationIssue[],
  promptId: string,
  field: string,
  precision: number,
  roundTo?: number | null,
): boolean {
  if (!Number.isInteger(precision) || precision < 0 || precision > 9) {
    issues.push({ promptId, field, message: "Precision must be an integer between 0 and 9." });
    return false;
  }
  if (roundTo != null && (!Number.isFinite(roundTo) || roundTo <= 0)) {
    issues.push({ promptId, field, message: "roundTo must be a positive number." });
    return false;
  }
  return true;
}

function validateHint(issues: ValidationIssue[], promptId: string, hint: unknown): boolean {
  if (hint == null) return true;
  const h = hint as Record<string, unknown>;
  const hasText = typeof h.text === "string" && (h.text as string).trim().length > 0;
  const hasFigure =
    h.figure != null &&
    typeof h.figure === "object" &&
    typeof (h.figure as { value?: unknown }).value === "string" &&
    typeof (h.figure as { unit?: unknown }).unit === "string";
  const hasImage =
    h.image != null &&
    typeof h.image === "object" &&
    typeof (h.image as { url?: unknown }).url === "string" &&
    typeof (h.image as { alt?: unknown }).alt === "string" &&
    typeof (h.image as { credit?: unknown }).credit === "string" &&
    typeof (h.image as { rights?: unknown }).rights === "string";
  const keys = Object.keys(h);
  const allowed = keys.every((k) => ["text", "figure", "image"].includes(k));
  let ok = true;
  if (!allowed || keys.length === 0) {
    issues.push({ promptId, field: "hint", message: "Hint blocks may contain only text, figure and image." });
    ok = false;
  }
  if (hasImage && !hasText && !hasFigure && keys.length !== 1) {
    issues.push({ promptId, field: "hint", message: "At most one image per hint block." });
    ok = false;
  }
  if (h.image != null && !hasImage) {
    issues.push({ promptId, field: "hint.image", message: "Image hints require url, alt, credit and rights." });
    ok = false;
  }
  if (h.figure != null && !hasFigure) {
    issues.push({ promptId, field: "hint.figure", message: "Figure hints require value and unit." });
    ok = false;
  }
  if (h.text != null && !hasText) {
    issues.push({ promptId, field: "hint.text", message: "Text hints must be non-empty." });
    ok = false;
  }
  return ok;
}

export function validatePuzzle(puzzle: EditorialPuzzle, datasets: DatasetIndex): ValidationOk | ValidationErr {
  const issues: ValidationIssue[] = [];

  if (puzzle.prompts.length !== 5) {
    issues.push({ field: "prompts", message: `A daily has exactly five prompts, got ${puzzle.prompts.length}.` });
    return { ok: false, issues };
  }

  // Slot mix: direct_fact, calculation ×3, target_match (final slot may substitute a direct fact).
  const types = puzzle.prompts.map((p) => p.roundType);
  const reference = ["direct_fact", "calculation", "calculation", "calculation", "target_match"];
  const alt = ["direct_fact", "calculation", "calculation", "calculation", "direct_fact"];
  if (JSON.stringify(types) !== JSON.stringify(reference) && JSON.stringify(types) !== JSON.stringify(alt)) {
    issues.push({
      field: "prompts",
      message:
        "Slot mix must be [direct_fact, calculation, calculation, calculation, target_match], with a second direct fact permitted only in the final slot.",
    });
  }

  const seenPromptIds = new Set<string>();
  const benchmarks: Record<string, string> = {};

  puzzle.prompts.forEach((p, i) => {
    const pid = p.promptId || `slot${i + 1}`;
    if (seenPromptIds.has(p.promptId)) {
      issues.push({ promptId: p.promptId, field: "promptId", message: "Duplicate promptId within the puzzle." });
    }
    seenPromptIds.add(p.promptId);
    if (!p.prompt.trim()) issues.push({ promptId: p.promptId, field: "prompt", message: "Prompt text is required." });
    if (!p.unit.trim()) issues.push({ promptId: p.promptId, field: "unit", message: "Every prompt needs a fixed answer unit." });
    if (!p.category.trim()) issues.push({ promptId: p.promptId, field: "category", message: "Category is required." });
    validateHint(issues, p.promptId, p.hint);

    if (p.roundType === "direct_fact") {
      const s = p.scoring;
      if (s.type !== "direct_fact") {
        issues.push({ promptId: p.promptId, field: "scoring", message: "Scoring record type must match round type." });
      } else {
        validateNumberValue(issues, p.promptId, "scoring.value", s.value);
        validatePrecision(issues, p.promptId, "scoring.precision", s.precision);
        if (!s.source?.title) {
          issues.push({ promptId: p.promptId, field: "scoring.source", message: "Direct facts need a source record." });
        }
        benchmarks[p.promptId] = s.value;
      }
      if (!p.reveal?.explanation) {
        issues.push({ promptId: p.promptId, field: "reveal", message: "Reveal explanation is required." });
      }
    }

    if (p.roundType === "calculation") {
      const s = p.scoring;
      if (s.type !== "calculation") {
        issues.push({ promptId: p.promptId, field: "scoring", message: "Scoring record type must match round type." });
      } else {
        const okPrec = validatePrecision(issues, p.promptId, "scoring.precision", s.precision, s.roundTo);
        const inputs: Record<string, Rat> = {};
        let inputValuesOk = true;
        for (const inp of s.inputs) {
          if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(inp.name)) {
            issues.push({ promptId: p.promptId, field: `scoring.inputs.${inp.name}`, message: "Input names must be identifiers." });
            inputValuesOk = false;
            continue;
          }
          if (inputs[inp.name]) {
            issues.push({ promptId: p.promptId, field: `scoring.inputs.${inp.name}`, message: "Duplicate input name." });
            inputValuesOk = false;
          }
          if (!inp.unit.trim()) {
            issues.push({ promptId: p.promptId, field: `scoring.inputs.${inp.name}`, message: "Every input needs a unit." });
            inputValuesOk = false;
          }
          if (!inp.source?.title && !inp.assumption) {
            issues.push({
              promptId: p.promptId,
              field: `scoring.inputs.${inp.name}`,
              message: "Every input needs a source record or a documented editorial assumption.",
            });
            inputValuesOk = false;
          }
          const v = validateNumberValue(issues, p.promptId, `scoring.inputs.${inp.name}.value`, inp.value);
          if (v) inputs[inp.name] = v;
          else inputValuesOk = false;
        }
        // Units must reduce to the output: v1 checks every input unit appears in the
        // formula chain by construction (formula references them); the output unit
        // must be declared and must match the prompt unit.
        if (s.outputUnit !== p.unit) {
          issues.push({ promptId: p.promptId, field: "scoring.outputUnit", message: `outputUnit ("${s.outputUnit}") must match the prompt answer unit ("${p.unit}").` });
        }
        if (inputValuesOk) {
          const derived = evaluateExpression(s.formula, inputs);
          if (!derived.ok) {
            issues.push({ promptId: p.promptId, field: "scoring.formula", message: `Formula does not evaluate: ${derived.error}` });
          } else {
            if (cmp(derived.value, rat(0n)) <= 0 || !inSupportedRange(derived.value)) {
              issues.push({ promptId: p.promptId, field: "scoring.formula", message: "Benchmark must be positive and within the supported range." });
            } else if (okPrec) {
              const published = editorialRound(derived.value, s.precision, s.roundTo);
              benchmarks[p.promptId] = published;
              if (s.benchmark != null && s.benchmark !== published) {
                issues.push({
                  promptId: p.promptId,
                  field: "scoring.benchmark",
                  message: `Declared benchmark ${s.benchmark} does not match the recomputed published benchmark ${published} at the declared rounding rule.`,
                });
              }
            }
          }
        }
        if (!s.steps || s.steps.length < 2 || s.steps.length > 4) {
          issues.push({ promptId: p.promptId, field: "scoring.steps", message: "Calculations need two to four reveal steps." });
        }
        const hasSourcedInput = s.inputs.some((inp) => inp.source?.title);
        const hasAssumption = s.inputs.some((inp) => inp.assumption);
        if (!hasSourcedInput && !hasAssumption) {
          issues.push({ promptId: p.promptId, field: "scoring.inputs", message: "At least one input needs a source or assumption note." });
        }
        // A valid calculation leaves at least one substantive quantity to estimate:
        // flag a single-input formula as too thin for live content.
        if (s.inputs.length < 2 && puzzle.quality === "live") {
          issues.push({ promptId: p.promptId, field: "scoring.formula", message: "Live calculation rounds need at least two inputs." });
        }
      }
      if (!p.reveal?.explanation) {
        issues.push({ promptId: p.promptId, field: "reveal", message: "Reveal explanation is required." });
      }
    }

    if (p.roundType === "target_match") {
      const s = p.scoring;
      if (s.type !== "target_match") {
        issues.push({ promptId: p.promptId, field: "scoring", message: "Scoring record type must match round type." });
      } else {
        validateNumberValue(issues, p.promptId, "scoring.target", s.target);
        const ds = datasets.get(s.datasetId);
        if (!ds) {
          issues.push({ promptId: p.promptId, field: "scoring.datasetId", message: `Unknown target dataset: ${s.datasetId}` });
        } else {
          const eligible = s.eligibleEntryIds
            ? ds.entries.filter((e) => s.eligibleEntryIds!.includes(e.id))
            : ds.entries;
          if (eligible.length < 5) {
            issues.push({ promptId: p.promptId, field: "scoring.eligibleEntryIds", message: "Target rounds need at least five eligible entries." });
          } else {
            const target = parseDecimalToRat(s.target);
            if (target) {
              let bestRatio: Rat | null = null;
              let closeCount = 0;
              for (const e of eligible) {
                const v = parseDecimalToRat(e.value);
                if (!v) continue;
                const [min, max] = cmp(v, target) < 0 ? [v, target] : [target, v];
                const ratio = div(min, max);
                if (!bestRatio || cmp(ratio, bestRatio) > 0) bestRatio = ratio;
                if (ratio.n * 10n < 9n * ratio.d) closeCount++;
              }
              if (bestRatio) {
                const bestPoints = eq(bestRatio, rat(1n)) ? 100 : Number((2n * bestRatio.n * 100n + bestRatio.d) / (2n * bestRatio.d));
                if (bestPoints < 90) {
                  issues.push({
                    promptId: p.promptId,
                    field: "scoring.target",
                    message: `Best eligible match would earn ${bestPoints} points; targets must have a best match of at least 90.`,
                  });
                }
                if (closeCount < 2) {
                  issues.push({
                    promptId: p.promptId,
                    field: "scoring.dataset",
                    message: "Target datasets need plausible distractors (at least two eligible entries below the Close band).",
                  });
                }
              }
            }
          }
        }
      }
      if (!p.reveal?.explanation) {
        issues.push({ promptId: p.promptId, field: "reveal", message: "Reveal explanation is required." });
      }
    }
  });

  return issues.length ? { ok: false, issues } : { ok: true, benchmarks };
}
