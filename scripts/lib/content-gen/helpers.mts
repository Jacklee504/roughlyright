/**
 * Content-generator helpers. Reuses the game's own exact-rational evaluator and
 * editorial rounding so generated benchmarks and reveal steps are guaranteed to
 * match what the validator recomputes.
 */

import { evaluateExpression } from "@/lib/domain/expression";
import { parseDecimalToRat, ratToString, cmp, rat } from "@/lib/domain/decimal";
import { inSupportedRange } from "@/lib/domain/numberParser";
import { editorialRound } from "@/lib/content/validate";
import type {
  EditorialDataset,
  EditorialPrompt,
  HintBlock,
  RevealRecord,
  SourceRef,
} from "@/lib/content/types";

/** Group an integer part with commas; keeps decimals verbatim. */
export function fmt(s: string): string {
  const [int, dec] = s.split(".");
  const grouped = int.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return dec ? `${grouped}.${dec}` : grouped;
}

function verbalize(formula: string, values: Record<string, string>): string {
  let s = formula.replace(/\*/g, " × ").replace(/\//g, " ÷ ").replace(/-/g, " − ");
  for (const [name, v] of Object.entries(values)) {
    s = s.replace(new RegExp(`\\b${name}\\b`, "g"), v);
  }
  return s.replace(/\s+/g, " ").trim();
}

export type CalcGroup = { id: string; category: string; variants: CalcVariant[] };

export type CalcVariant = {
  slug: string;
  prompt: string;
  unit: string;
  formula: string;
  /** [name, value, unit, note] — note starting with "Assumption:" becomes the
   *  documented editorial assumption; otherwise it is the source title. */
  inputs: [string, string, string, string][];
  precision: number;
  roundTo?: number | null;
  model: string; // step-1 sentence; {name} placeholders are replaced by "value unit"
  explanation: string;
  sourceTitle?: string;
  hint?: HintBlock | null;
  countMode?: boolean;
};

/** Build one calculation EditorialPrompt, computing the exact benchmark. */
export function calcPrompt(familyId: string, category: string, v: CalcVariant): EditorialPrompt {
  const inputRats: Record<string, ReturnType<typeof parseDecimalToRat>> = {};
  const displayValues: Record<string, string> = {};
  const inputs = v.inputs.map(([name, value, unit, note]) => {
    const r = parseDecimalToRat(value);
    if (!r) throw new Error(`${familyId}-${v.slug}: bad input value ${value}`);
    inputRats[name] = r;
    displayValues[name] = value;
    return {
      name,
      value,
      unit,
      assumption: note.startsWith("Assumption:") ? note.slice("Assumption:".length).trim() : null,
      source: note.startsWith("Assumption:") ? null : { title: note, url: null, note: null },
    };
  });
  const derived = evaluateExpression(v.formula, inputRats);
  if (!derived.ok) throw new Error(`${familyId}-${v.slug}: formula error: ${derived.error}`);
  if (cmp(derived.value, rat(0n)) <= 0 || !inSupportedRange(derived.value)) {
    throw new Error(`${familyId}-${v.slug}: benchmark out of range: ${ratToString(derived.value)}`);
  }
  const exactStr = ratToString(derived.value, 6); // display only; the published value is exact below
  const published = editorialRound(derived.value, v.precision, v.roundTo);

  const model = Object.entries(displayValues).reduce(
    (s, [name, value]) => s.replace(new RegExp(`\\{${name}\\}`, "g"), `${value} ${inputs.find((i) => i.name === name)!.unit}`),
    v.model,
  );
  const compute = `Compute: ${verbalize(v.formula, displayValues)} = ${fmt(exactStr)}`;
  const worked = `Worked estimate: ${published} ${v.unit}${v.roundTo ? ` (nearest ${fmt(String(v.roundTo))})` : ""}`;
  const steps = [`Model: ${model}`, compute, worked];

  const promptId = `${familyId}-${v.slug}`;
  return {
    promptId,
    roundType: "calculation",
    category,
    prompt: v.prompt,
    scope: null,
    unit: v.unit,
    countMode: v.countMode ?? false,
    hint: v.hint ?? null,
    scoring: {
      type: "calculation",
      formula: v.formula,
      inputs,
      outputUnit: v.unit,
      precision: v.precision,
      roundTo: v.roundTo ?? null,
      steps,
    },
    reveal: {
      explanation: v.explanation,
      sourceTitle: v.sourceTitle ?? null,
      steps,
    } satisfies RevealRecord,
  };
}

export type DirectSpec = {
  id: string;
  category: string;
  prompt: string;
  unit: string;
  value: string;
  precision: number;
  fact: string;
  sourceTitle: string;
};

/** Build one direct-fact EditorialPrompt (mathematically defined conversions). */
export function directPrompt(s: DirectSpec): EditorialPrompt {
  const source: SourceRef = { title: s.sourceTitle, url: null, note: null };
  return {
    promptId: `df-${s.id}`,
    roundType: "direct_fact",
    category: s.category,
    prompt: s.prompt,
    scope: null,
    unit: s.unit,
    countMode: /^\d+$/.test(s.value),
    hint: null,
    scoring: { type: "direct_fact", value: s.value, precision: s.precision, source },
    reveal: { explanation: `Exactly ${fmt(s.value)} ${s.unit} — ${s.fact}`, sourceTitle: s.sourceTitle },
  };
}

export type TargetSpec = {
  id: string;
  category: string;
  datasetId: string;
  datasetNoun: string;
  unit: string;
  target: string;
  comparison: string;
  sourceTitle: string;
  prompt?: string; // overrides the generic "Which <noun> is closest to <target> <unit>?" phrasing
};

/** Build one target-match EditorialPrompt. */
export function targetPrompt(s: TargetSpec): EditorialPrompt {
  return {
    promptId: `tg-${s.id}`,
    roundType: "target_match",
    category: s.category,
    prompt: s.prompt ?? `Which ${s.datasetNoun} is closest to ${fmt(s.target)} ${s.unit}?`,
    scope: "Pick from the dataset list; closeness to the target is what scores.",
    unit: s.unit,
    countMode: false,
    hint: null,
    scoring: { type: "target_match", datasetId: s.datasetId, target: s.target },
    reveal: {
      explanation: `Your pick is compared with the target; the closest eligible ${s.datasetNoun}s are shown.`,
      comparison: s.comparison,
      sourceTitle: s.sourceTitle,
    },
  };
}

type EntrySpec = [id: string, label: string, value: string, aliases?: string[]];

const TABLE_SOURCE: SourceRef = {
  title: "Editorial reference table compiled from public reference data",
  url: null,
  note: "Quantitative dataset curated for target-match rounds; values verified against public reference sources at authoring time.",
};

/** Build a target dataset from compact entry tuples. */
export function dataset(id: string, name: string, unit: string, entries: EntrySpec[]): EditorialDataset {
  return {
    kind: "target_dataset",
    game: "estimation",
    id,
    name,
    unit,
    revision: "2026-11-a",
    eligibleScope: null,
    entries: entries.map(([eid, label, value, aliases]) => ({
      id: eid,
      label,
      disambiguator: null,
      value,
      source: TABLE_SOURCE,
      aliases: aliases ?? [],
    })),
  };
}
