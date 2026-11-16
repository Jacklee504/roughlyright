import { getDb } from "../src/lib/db/client";

/**
 * Daily operations job (Q23, Q47): atomic, restart-safe rollups and retention
 * cleanup. Run by the operator scheduler (cron/Netlify scheduled function):
 *
 *   npx tsx scripts/jobs-daily.mts
 *
 * Retention defaults (Q23):
 * - guest-linked play data purged after 12 months of guest inactivity
 * - closed content reports deleted 12 months after closing
 * - anonymous daily rollups (site_events) retained 12 months
 */

async function main() {
  const db = await getDb();

  // --- Rollup: reconcile anonymous daily event counters with ground truth ----
  // site_events rows written by the app are recomputed from attempt facts so
  // counters can never drift (Q47). Detailed buckets keep the app's shape.
  await db.transaction(async (tx) => {
    await tx.query(`
      insert into site_events (day, game_slug, event, detail, count)
      select (started_at at time zone 'UTC')::date, 'estimation', 'start', mode, count(*)
      from attempts
      group by 1, 4
      on conflict (day, game_slug, event, detail) do update set count = excluded.count
    `);
    await tx.query(`
      insert into site_events (day, game_slug, event, detail, count)
      select completion_date, 'estimation', 'completion', mode, count(*)
      from attempts
      where state = 'completed' and completion_date is not null
      group by 1, 4
      on conflict (day, game_slug, event, detail) do update set count = excluded.count
    `);
  });
  console.log("rollup: site_events reconciled");

  // --- Retention -------------------------------------------------------------
  const purged = await db.query<{ count: string }>(`
    with stale as (
      select guest_id from attempts
      group by guest_id
      having max(started_at) < now() - interval '12 months'
    )
    delete from attempts a using stale s
    where a.guest_id = s.guest_id
    returning 1
  `);
  console.log(`retention: purged ${purged.rows.length} guest-linked attempts (12 months inactive)`);

  await db.transaction(async (tx) => {
    await tx.query(`
      insert into site_events (day, game_slug, event, detail, count)
      values (current_date, 'estimation', 'retention', '', 0)
      on conflict (day, game_slug, event, detail) do update set count = excluded.count
    `);
    await tx.query(`
      update site_events set count = count + $1
      where day = current_date and game_slug = 'estimation' and event = 'retention' and detail = ''
    `, [purged.rows.length]);
  });

  const reports = await db.query<{ count: string }>(`
    delete from content_reports
    where status in ('resolved', 'dismissed') and created_at < now() - interval '12 months'
    returning 1
  `);
  console.log(`retention: deleted ${reports.rows.length} closed content reports`);

  const events = await db.query<{ count: string }>(`
    delete from site_events where day < current_date - interval '12 months' returning 1
  `);
  console.log(`retention: deleted ${events.rows.length} old daily rollup rows`);

  process.exit(0);
}

main().catch((e) => {
  console.error(String(e));
  process.exit(1);
});
