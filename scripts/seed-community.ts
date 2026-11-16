/**
 * Seeds synthetic community attempts & guess distributions for local development
 * so that percentile calculations, community curves, and accuracy benchmarks
 * are immediately visible before real players play.
 */

import { getDb } from "../src/lib/db/client";
import { randomUUID } from "node:crypto";

async function main() {
  const db = await getDb();
  console.log("Seeding dummy community attempts and guess distributions...");

  // Get current active live puzzle
  const puzzles = await db.query<{ id: string; date: string; prompt_revision_ids: string[] }>(
    `select id, date::text as date, prompt_revision_ids from puzzles where game_slug = 'estimation' and status = 'live' order by date asc limit 10`
  );

  if (puzzles.rows.length === 0) {
    console.log("No puzzles found to seed community data for.");
    process.exit(0);
  }

  // Generate 65 synthetic guest players for each puzzle to exceed the 50-player threshold
  const NUM_COMMUNITY_PLAYERS = 65;

  for (const pz of puzzles.rows) {
    console.log(`Generating community data for puzzle ${pz.date} (${pz.prompt_revision_ids.length} rounds)...`);

    for (let p = 0; p < NUM_COMMUNITY_PLAYERS; p++) {
      const guestId = `dummy_guest_${pz.date}_${p}`;

      // Insert guest
      await db.query(`insert into guests (id, created_at) values ($1, now()) on conflict (id) do nothing`, [guestId]);

      const attemptId = randomUUID();
      let totalScore = 0;

      // Create completed daily attempt
      await db.query(
        `insert into attempts (id, guest_id, puzzle_id, mode, state, current_ordinal, started_at, completed_at, completion_date, score)
         values ($1, $2, $3, 'daily', 'completed', 5, now() - interval '2 hours', now() - interval '1 hour', $4, 0)
         on conflict (guest_id, puzzle_id, mode) do nothing`,
        [attemptId, guestId, pz.id, pz.date]
      );

      // Create rounds with realistic log-normal error factors
      // Some players are very close (1.0 - 1.1x), some in range (1.2 - 2.0x), some far (2.5 - 6x)
      for (let ord = 1; ord <= pz.prompt_revision_ids.length; ord++) {
        const revId = pz.prompt_revision_ids[ord - 1];

        // Random distribution sampling
        const rand = Math.random();
        let errorFactor: number;
        let mark: string;
        let points: number;

        if (rand < 0.15) {
          // Exact / Close
          errorFactor = 1.0 + Math.random() * 0.08;
          mark = errorFactor <= 1.01 ? "Exact" : "Close";
          points = Math.round(100 / errorFactor);
        } else if (rand < 0.65) {
          // In range
          errorFactor = 1.1 + Math.random() * 0.85; // 1.1x to 1.95x
          mark = "In range";
          points = Math.round(100 / errorFactor);
        } else if (rand < 0.95) {
          // Far
          errorFactor = 2.1 + Math.random() * 3.5; // 2.1x to 5.6x
          mark = "Far";
          points = Math.max(5, Math.round(100 / errorFactor));
        } else {
          // Pass
          errorFactor = 10.0;
          mark = "Pass";
          points = 0;
        }

        totalScore += points;

        await db.query(
          `insert into attempt_rounds (attempt_id, ordinal, revision_id, opened_at, outcome, points, mark, error_factor, resolved_at)
           values ($1, $2, $3, now() - interval '90 minutes', $4, $5, $6, $7, now() - interval '80 minutes')
           on conflict (attempt_id, ordinal) do nothing`,
          [attemptId, ord, revId, mark === "Pass" ? "pass" : "scored", points, mark, errorFactor.toFixed(3)]
        );
      }

      // Update attempt score
      await db.query(`update attempts set score = $1 where id = $2`, [totalScore, attemptId]);
    }
  }

  console.log(`✓ Successfully seeded community distribution data for ${puzzles.rows.length} puzzles (${NUM_COMMUNITY_PLAYERS} community players each).`);
  process.exit(0);
}

main().catch((e) => {
  console.error("Seeding error:", e);
  process.exit(1);
});
