import { getDb } from "../src/lib/db/client";

/**
 * Private operator CLI for content-report triage (Q11, C4).
 * No email integration; editors review the queue here.
 *
 *   npx tsx scripts/triage.mts list [--status open|resolved|dismissed]
 *   npx tsx scripts/triage.mts resolve <report-id>
 *   npx tsx scripts/triage.mts dismiss <report-id>
 */
async function main() {
  const [cmd, ...rest] = process.argv.slice(2);
  const db = await getDb();

  if (cmd === "list") {
    const status = rest[0]?.replace("--status ", "") ?? "open";
    const rows = await db.query(
      `select r.id, r.created_at::date::text as day, r.status, r.reason,
              pr.prompt_id, pr.game_slug, p.date::text as puzzle_date
       from content_reports r
       join prompt_revisions pr on pr.revision_id = r.revision_id
       left join puzzles p on p.prompt_revision_ids ? pr.revision_id::text
       where r.status = $1
       order by r.created_at asc
       limit 100`,
      [status],
    );
    if (rows.rows.length === 0) {
      console.log(`No ${status} reports.`);
    }
    for (const r of rows.rows) {
      console.log(`${r.id}  ${r.day}  ${r.game_slug} ${r.puzzle_date ?? "?"}  ${r.prompt_id}\n    ${String(r.reason).slice(0, 200)}`);
    }
    process.exit(0);
  }

  if (cmd === "resolve" || cmd === "dismiss") {
    const id = rest[0];
    if (!id) throw new Error(`Usage: triage.mts ${cmd} <report-id>`);
    const status = cmd === "resolve" ? "resolved" : "dismissed";
    const rows = await db.query(`update content_reports set status = $2 where id = $1 returning id`, [id, status]);
    console.log(rows.rows.length ? `${cmd}d ${id}` : `No report ${id}`);
    process.exit(0);
  }

  console.log(`Usage:\n  triage.mts list [--status open|resolved|dismissed]\n  triage.mts resolve <report-id>\n  triage.mts dismiss <report-id>`);
  process.exit(1);
}

main().catch((e) => {
  console.error(String(e));
  process.exit(1);
});
