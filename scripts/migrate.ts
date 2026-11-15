import { getDb } from "../src/lib/db/client";

async function main() {
  const db = await getDb();
  console.log("Migrations applied.");
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
