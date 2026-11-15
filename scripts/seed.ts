import path from "node:path";
import { getDb } from "../src/lib/db/client";
import { importDirectory } from "../src/lib/content/import";

/**
 * Imports editorial content. Fixtures are demonstration content only; approved
 * live content lives under content/live/ and passes the same validation.
 */
async function main() {
  const db = await getDb();
  const dirs = [path.join(process.cwd(), "content", "fixtures"), path.join(process.cwd(), "content", "live")];
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
