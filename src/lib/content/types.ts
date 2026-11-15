/** Editorial content file types (typed JSON under content/). */

export type SourceRef = {
  title: string;
  url?: string | null;
  note?: string | null;
};

export type RoundType = "direct_fact" | "calculation" | "target_match";

export type HintBlock =
  | { text: string }
  | { figure: { value: string; unit: string; scope?: string } }
  | { image: { url: string; alt: string; credit: string; rights: string } }
  | { text: string; image: { url: string; alt: string; credit: string; rights: string } };

export type DirectFactScoring = {
  type: "direct_fact";
  value: string; // positive decimal, scoring unit
  precision: number; // documented decimal places of the published figure
  source: SourceRef;
  asOf?: string | null;
};

export type CalcInput = {
  name: string; // identifier used in the formula
  value: string; // positive decimal
  unit: string;
  source?: SourceRef | null; // sourced input
  assumption?: string | null; // documented representative assumption
};

export type CalculationScoring = {
  type: "calculation";
  formula: string; // expression over input names
  inputs: CalcInput[];
  outputUnit: string; // must match the prompt unit
  precision: number; // decimal places of the published benchmark
  roundTo?: number | null; // optional editorial rounding to a nearest multiple (e.g. 1000)
  benchmark?: string | null; // must equal the recomputed published benchmark
  steps: string[]; // 2–4 reveal steps (public)
};

export type TargetMatchScoring = {
  type: "target_match";
  datasetId: string;
  target: string; // positive decimal
  eligibleEntryIds?: string[] | null; // null = whole dataset
};

export type ScoringRecord = DirectFactScoring | CalculationScoring | TargetMatchScoring;

export type RevealRecord = {
  explanation: string; // concise explanation / worked reveal intro
  sourceTitle?: string | null;
  sourceUrl?: string | null;
  comparison?: string | null; // optional familiar comparison sentence
  steps?: string[] | null; // calculation: final step labelled "Worked estimate" by importer
};

export type EditorialPrompt = {
  promptId: string;
  roundType: RoundType;
  category: string;
  prompt: string;
  scope?: string | null;
  unit: string;
  countMode?: boolean;
  hint?: HintBlock | null;
  scoring: ScoringRecord;
  reveal: RevealRecord;
};

export type EditorialPuzzle = {
  kind: "estimation_puzzle";
  game: string;
  date?: string; // absolute UTC date
  dayOffset?: number; // relative to import day (UTC); ignored when date given
  themeTag?: string | null;
  quality: "fixture" | "live";
  prompts: EditorialPrompt[]; // exactly five, ordered
};

export type TargetEntry = {
  id: string;
  label: string;
  disambiguator?: string | null;
  value: string; // positive decimal, dataset unit
  source: SourceRef;
  aliases?: string[];
};

export type EditorialDataset = {
  kind: "target_dataset";
  game: string;
  id: string;
  name: string;
  unit: string;
  revision: string;
  eligibleScope?: string | null;
  entries: TargetEntry[];
};

export type EditorialFile = EditorialPuzzle | EditorialDataset;
