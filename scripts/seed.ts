import path from "node:path";
import { readdirSync, statSync } from "node:fs";
import { getDb } from "../src/lib/db/client";
import { importDirectory } from "../src/lib/content/import";

function countJsonFiles(dir: string): number {
  let n = 0;
  for (const f of readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, f.name);
    if (f.isDirectory()) n += countJsonFiles(p);
    else if (f.name.endsWith(".json")) n++;
  }
  return n;
}

/**
 * Imports editorial content. Live content under content/live/ always imports.
 * Fixture demo content (content/fixtures/) imports only when no live puzzle
 * content exists — fixtures never overwrite or displace approved live dailies
 * (see OPEN_QUESTIONS Q1: fixtures are local demo material only).
 */
async function main() {
  const db = await getDb();
  const liveDir = path.join(process.cwd(), "content", "live");
  const hasLive = countJsonFiles(liveDir) > 0;
  const dirs = hasLive
    ? [liveDir]
    : [path.join(process.cwd(), "content", "fixtures"), liveDir];
  if (!hasLive) console.log("No live content found — importing fixtures as demo content.");
  for (const dir of dirs) {
    const result = await importDirectory(db, dir);
    for (const d of result.datasets) console.log(`imported dataset: ${d}`);
    for (const p of result.puzzles) console.log(`imported puzzle: ${p.game} ${p.date} (${p.quality})`);
    for (const w of result.warnings) console.warn(`warning: ${w}`);
  }
  process.exit(0);
}

main().catch((e) => {
  console.error(String(e));
  process.exit(1);
});
