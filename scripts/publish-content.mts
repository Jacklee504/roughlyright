import path from "node:path";
import { getDb } from "../src/lib/db/client";
import { importDirectory } from "../src/lib/content/import";

/**
 * Production publication path: imports approved live content only.
 * - Rejects fixture/synthetic material (Q1, C2).
 * - Requires version-controlled release approval metadata (content/live/approvals.json,
 *   one named editor + review date per puzzle date, Q12).
 * - Freezes datasets referenced by published puzzles (Q1).
 *
 * Operators run `npm run content:publish` with the production DATABASE_URL.
 * Local seeding stays `npm run db:seed`.
 */
async function main() {
  const db = await getDb();
  const dir = path.join(process.cwd(), "content", "live");
  const result = await importDirectory(db, dir, { production: true });
  for (const d of result.datasets) console.log(`published dataset: ${d}`);
  for (const p of result.puzzles) console.log(`published puzzle: ${p.game} ${p.date} (${p.quality})`);
  for (const w of result.warnings) console.warn(`warning: ${w}`);
  process.exit(0);
}

main().catch((e) => {
  console.error(String(e));
  process.exit(1);
});
