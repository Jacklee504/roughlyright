import { applyMigrations, getDb } from "../src/lib/db/client";

/**
 * Applies migrations. Locally this is the embedded PGlite database; with
 * DATABASE_URL set it runs against the hosted PostgreSQL (run once per
 * environment, e.g. before a Netlify deploy serves traffic).
 */
async function main() {
  const db = await getDb();
  await applyMigrations(db);
  console.log("Migrations applied.");
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
