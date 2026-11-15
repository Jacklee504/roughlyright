/**
 * Content importer: validates typed editorial files and publishes whole puzzles
 * as atomic revisions. Datasets import first, then puzzles. Re-running on
 * identical content is idempotent. Live (published) scoring content is immutable.
 */

import { createHash } from "node:crypto";
import { readdirSync, readFileSync, existsSync } from "node:fs";
import path from "node:path";
import type { Db } from "@/lib/db/client";
import { utcToday } from "@/lib/domain/calendar";
import { validateDataset, validatePuzzle, type DatasetIndex } from "./validate";
import type { EditorialDataset, EditorialPuzzle } from "./types";

function deterministicUuid(...parts: string[]): string {
  const hash = createHash("sha256").update(parts.join("\u0000")).digest("hex");
  const u = `${hash.slice(0, 8)}-${hash.slice(8, 12)}-4${hash.slice(13, 16)}-8${hash.slice(17, 20)}-${hash.slice(20, 32)}`;
  return u;
}

function contentHash(obj: unknown): string {
  return createHash("sha256").update(JSON.stringify(obj)).digest("hex");
}

export type ImportResult = {
  puzzles: { game: string; date: string; quality: string }[];
  datasets: string[];
  warnings: string[];
};

export class ImportError extends Error {}

async function upsertGame(db: Db, slug: string): Promise<void> {
  const names: Record<string, string> = { estimation: "Estimation", rarity: "Rarity" };
  await db.query(
    `insert into games (slug, name, rules_version) values ($1, $2, '1')
     on conflict (slug) do nothing`,
    [slug, names[slug] ?? slug],
  );
}

export async function importDataset(db: Db, ds: EditorialDataset): Promise<void> {
  const issues: { field: string; message: string }[] = [];
  const ok = validateDataset(ds, issues);
  if (!ok) {
    throw new ImportError(
      `Dataset ${ds.id} failed validation:\n` + issues.map((i) => `- ${i.field}: ${i.message}`).join("\n"),
    );
  }
  await upsertGame(db, ds.game);
  await db.query(
    `insert into target_datasets (id, game_slug, name, unit, revision, eligible_scope)
     values ($1,$2,$3,$4,$5,$6)
     on conflict (id) do update set name=$3, unit=$4, revision=$5, eligible_scope=$6`,
    [ds.id, ds.game, ds.name, ds.unit, ds.revision, ds.eligibleScope ?? null],
  );
  for (const e of ds.entries) {
    await db.query(
      `insert into target_entries (dataset_id, entry_id, label, disambiguator, value, source, aliases)
       values ($1,$2,$3,$4,$5,$6,$7)
       on conflict (dataset_id, entry_id) do update
         set label=$3, disambiguator=$4, value=$5, source=$6, aliases=$7`,
      [ds.id, e.id, e.label, e.disambiguator ?? null, e.value, JSON.stringify(e.source), e.aliases ?? []],
    );
    const keys: { kind: string; key: string }[] = [
      { kind: "label", key: e.label },
      ...(e.aliases ?? []).map((a) => ({ kind: "alias", key: a })),
    ];
    for (const k of keys) {
      const norm = k.key
        .normalize("NFKC")
        .toLowerCase()
        .normalize("NFD")
        .replace(/\p{M}+/gu, "")
        .normalize("NFC")
        .replace(/[’'`´]/g, "")
        .replace(/[^a-z0-9]+/g, " ")
        .trim()
        .replace(/\s+/g, " ");
      await db.query(
        `insert into target_lookup (dataset_id, entry_id, kind, norm_key) values ($1,$2,$3,$4)
         on conflict (dataset_id, norm_key, kind, entry_id) do nothing`,
        [ds.id, e.id, k.kind, norm],
      );
    }
  }
}

async function importPuzzle(db: Db, puzzle: EditorialPuzzle, datasets: DatasetIndex): Promise<void> {
  const result = validatePuzzle(puzzle, datasets);
  if (!result.ok) {
    throw new ImportError(
      `Puzzle failed validation:\n` + result.issues.map((i) => `- [${i.promptId ?? "-"}] ${i.field}: ${i.message}`).join("\n"),
    );
  }
  const benchmarks = result.ok ? result.benchmarks : {};

  // Resolve the UTC date.
  let date: string;
  if (puzzle.date) date = puzzle.date;
  else if (typeof puzzle.dayOffset === "number") date = addDays(utcToday(), puzzle.dayOffset);
  else throw new ImportError("Editorial puzzles need either `date` or `dayOffset`.");

  await upsertGame(db, puzzle.game);

  const revisionIds: string[] = [];
  for (const p of puzzle.prompts) {
    const revisionId = deterministicUuid("rev", puzzle.game, p.promptId, contentHash(p));
    const existing = await db.query<{ revision_id: string; status: string; quality: string; private: unknown; reveal: unknown; prompt_text: string }>(
      `select revision_id, status, quality, private, reveal, prompt_text from prompt_revisions where revision_id = $1`,
      [revisionId],
    );
    const privatePayload = buildPrivateScoring(p, benchmarks[p.promptId] ?? null);
    if (existing.rows.length > 0) {
      const row = existing.rows[0];
      if (row.status === "live" && row.quality === "live") {
        // Immutable once live: identical re-import must match; edits create new revisions naturally.
        if (JSON.stringify(row.private) !== JSON.stringify(privatePayload)) {
          throw new ImportError(
            `Prompt ${p.promptId}: live scoring content is immutable. Create a new revision instead.`,
          );
        }
      }
      // Re-import of identical/fixture content is idempotent.
      revisionIds.push(row.revision_id);
      continue;
    }
    await db.query(
      `insert into prompt_revisions
        (revision_id, prompt_id, game_slug, round_type, category, prompt_text, scope, unit, count_mode, hint, private, reveal, quality, status)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,'live')`,
      [
        revisionId,
        p.promptId,
        puzzle.game,
        p.roundType,
        p.category,
        p.prompt,
        p.scope ?? null,
        p.unit,
        p.countMode ?? false,
        p.hint ? JSON.stringify(p.hint) : null,
        JSON.stringify(privatePayload),
        JSON.stringify(p.reveal),
        puzzle.quality,
      ],
    );
    revisionIds.push(revisionId);
  }

  const puzzleId = deterministicUuid("puzzle", puzzle.game, date);
  const contentRevision = contentHash(revisionIds);
  const existingPuzzle = await db.query<{ status: string }>(
    `select status from puzzles where game_slug = $1 and date = $2`,
    [puzzle.game, date],
  );
  if (existingPuzzle.rows.length > 0 && existingPuzzle.rows[0].status === "live" && puzzle.quality === "live") {
    // Whole-puzzle atomic publishing: replacing a live puzzle is an editorial action, not an import accident.
    const existingRevisions = await db.query<{ prompt_revision_ids: string[] }>(
      `select prompt_revision_ids from puzzles where game_slug = $1 and date = $2`,
      [puzzle.game, date],
    );
    if (JSON.stringify(existingRevisions.rows[0].prompt_revision_ids) !== JSON.stringify(revisionIds)) {
      throw new ImportError(
        `Puzzle for ${puzzle.game} ${date} is already live with different content. Use a new content revision deliberately.`,
      );
    }
    return;
  }
  await db.query(
    `insert into puzzles (id, game_slug, date, display_number, theme_tag, content_revision, rules_version, status, prompt_revision_ids)
     values ($1,$2,$3,$4,$5,$6,'1','live',$7)
     on conflict (game_slug, date) do update
       set display_number = $4, theme_tag = $5, content_revision = $6, status = 'live', prompt_revision_ids = $7`,
    [puzzleId, puzzle.game, date, 0, puzzle.themeTag ?? null, contentRevision, revisionIds],
  );
}

function buildPrivateScoring(
  p: EditorialPuzzle["prompts"][number],
  benchmark: string | null,
): unknown {
  if (p.scoring.type === "calculation") {
    return { ...p.scoring, benchmark: benchmark ?? p.scoring.benchmark ?? null };
  }
  return p.scoring;
}

function addDays(date: string, days: number): string {
  const d = new Date(date + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Recompute sequential display numbers (per game, by date ascending). */
async function renumber(db: Db): Promise<void> {
  await db.query(
    `with ranked as (
       select id, row_number() over (partition by game_slug order by date asc) as rn
       from puzzles
     )
     update puzzles p set display_number = r.rn
     from ranked r where r.id = p.id and p.display_number <> r.rn`,
  );
}

/** Import every JSON file under the given directory (datasets before puzzles). */
export async function importDirectory(db: Db, dir: string): Promise<ImportResult> {
  const files: string[] = [];
  const walk = (d: string) => {
    if (!existsSync(d)) return;
    for (const f of readdirSync(d, { withFileTypes: true })) {
      if (f.isFile() && f.name.endsWith(".json")) files.push(path.join(d, f.name));
      else if (f.isDirectory()) walk(path.join(d, f.name));
    }
  };
  walk(dir);

  const rawFiles = files.map((f) => ({ path: f, json: JSON.parse(readFileSync(f, "utf8")) as unknown }));
  const datasets = rawFiles.filter((f) => (f.json as { kind?: string }).kind === "target_dataset") as { path: string; json: EditorialDataset }[];
  const puzzles = rawFiles.filter((f) => (f.json as { kind?: string }).kind === "estimation_puzzle") as { path: string; json: EditorialPuzzle }[];

  const index: DatasetIndex = new Map(datasets.map((d) => [d.json.id, d.json]));
  const result: ImportResult = { puzzles: [], datasets: [], warnings: [] };

  for (const ds of datasets) {
    await importDataset(db, ds.json);
    result.datasets.push(ds.json.id);
  }
  for (const pz of puzzles) {
    await importPuzzle(db, pz.json, index);
    const date = pz.json.date ?? addDays(utcToday(), pz.json.dayOffset ?? 0);
    result.puzzles.push({ game: pz.json.game, date, quality: pz.json.quality });
  }
  await renumber(db);
  return result;
}
