import { getDb } from "../src/lib/db/client";
import { importDirectory } from "../src/lib/content/import";
import path from "node:path";

async function run() {
  const db = await getDb();
  console.log("Applying live content import to DB...");
  const liveDir = path.join(process.cwd(), "content", "live");
  const res = await importDirectory(db, liveDir);
  console.log(`Imported ${res.puzzles.length} puzzles.`);
  for (const p of res.puzzles) {
    if (["2026-11-13", "2026-11-14", "2026-11-15"].includes(p.date)) {
      console.log(`  -> Archive puzzle ready: ${p.date}`);
    }
  }
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
