/** Allowlisted client DTOs. Private scoring data never crosses this boundary. */

export type RoundType = "direct_fact" | "calculation" | "target_match";
export type Mark = "Exact" | "Close" | "In range" | "Far" | "Pass";

export type PromptPublic = {
  ordinal: number;
  roundType: RoundType;
  category: string;
  prompt: string;
  scope: string | null;
  unit: string;
  countMode: boolean;
  hintAvailable: boolean;
};

export type RevealSource = {
  title: string;
  url?: string | null;
};

export type ClosestMatch = {
  label: string;
  valueDisplay: string;
  sourceTitle: string;
  sourceUrl?: string | null;
};

export type RoundResolved = {
  ordinal: number;
  revisionId: string;
  roundType: RoundType;
  promptText: string;
  category: string;
  outcome: "scored" | "pass";
  /** Numeric rounds: the player's locked guess. */
  guess?: { display: string; canonical: string } | null;
  /** Target rounds: the named entity chosen. */
  entity?: { label: string; valueDisplay: string } | null;
  points: number;
  mark: Mark;
  /** "high"/"low" for numerical guesses; "higher than target"/"lower than target" for target rounds. */
  direction?: string | null;
  absoluteGap?: { display: string; unit: string } | null;
  /** Target rounds: co-best eligible dataset entries (up to 3 alphabetical + count). */
  closest?: { entries: ClosestMatch[]; moreCount: number } | null;
  /** Own-data only (never shared): how many times off the truth, as a decimal string ("1.45"). */
  errorFactor?: string | null;
  reveal: {
    benchmarkLabel: "Official figure" | "Worked estimate" | null;
    targetDisplay: string | null;
    unit: string;
    explanation: string;
    source?: RevealSource | null;
    comparison?: string | null;
    steps?: string[] | null;
  };
  /** Community percentile, shown only once 50+ non-pass ranked guesses exist. */
  percentile?: number | null;
  hintText?: string | null;
  hintFigure?: { value: string; unit: string; scope?: string } | null;
};

export type Recap = {
  game: string;
  puzzleDate: string;
  displayNumber: number;
  mode: "daily" | "archive";
  total: number;
  maxTotal: number;
  rounds: RoundResolved[];
  closestRound: { ordinal: number; shortLabel: string } | null;
  nextResetIso: string;
};

export type AttemptState = {
  attemptId: string;
  mode: "daily" | "archive";
  puzzleDate: string;
  displayNumber: number;
  themeTag: string | null;
  state: "active" | "completed" | "expired";
  ordinal: number;
  score: number;
  expiresAt: string | null;
  prompt: PromptPublic | null;
  resolved: RoundResolved | null;
  recap: Recap | null;
  shareToken: string | null;
};

export type GameStatus = {
  game: string;
  date: string;
  nextResetIso: string;
  puzzleAvailable: boolean;
  puzzleNumber: number | null;
  themeTag: string | null;
  attempt: { exists: boolean; state: "none" | "active" | "completed" | "expired"; score: number; mode: string } | null;
  streak: { current: number; best: number };
};

export type TaggedErr<T extends string = string> = { ok: false; code: T; message: string };

export type Suggestions = { ok: true; suggestions: { label: string; disambiguator: string | null }[] };
