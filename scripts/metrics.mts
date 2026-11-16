import { getDb } from "../src/lib/db/client";

/**
 * Q45 — directional KPI report.
 *
 * Primary metric: D7 return among first-time finishers (a guest's first
 * *completed ranked daily* is the anchor; D7 = they complete another daily
 * within 7 days). Secondary: D1 return, completion rate, share rate and the
 * invalid-input correction rate. Anything below 100 qualified first-time
 * finishers is explicitly marked directional (no performance verdict).
 */

type DayRow = {
  day: string;
  first_time: number;
  d1_returns: number;
  d7_returns: number;
  started: number;
  completed: number;
  shared: number;
  invalid: number;
  corrected: number;
};

const db = await getDb();

const daysArg = Number(process.argv[2] ?? "14");
const windowDays = Number.isFinite(daysArg) && daysArg > 0 ? Math.min(daysArg, 90) : 14;

const rows = await db.query<DayRow>(`
  with daily_starts as (
    select (a.started_at at time zone 'UTC')::date as day,
           count(*)::int as started
    from attempts a join puzzles p on p.id = a.puzzle_id
    where p.game_slug = 'estimation' and a.mode = 'daily'
      and a.started_at >= (current_date - ($1::int))::timestamptz
    group by 1
  ),
  daily_finishes as (
    select (a.completed_at at time zone 'UTC')::date as day,
           count(*)::int as completed
    from attempts a join puzzles p on p.id = a.puzzle_id
    where p.game_slug = 'estimation' and a.mode = 'daily' and a.state = 'completed'
      and a.completed_at >= (current_date - ($1::int))::timestamptz
    group by 1
  ),
  first_completion as (
    -- Anchor: each guest's first completed ranked daily (Q45).
    select a.guest_id,
           (min(a.completed_at) at time zone 'UTC')::date as first_day
    from attempts a join puzzles p on p.id = a.puzzle_id
    where p.game_slug = 'estimation' and a.mode = 'daily' and a.state = 'completed'
    group by a.guest_id
  ),
  later_completion as (
    select f.guest_id, f.first_day,
           min((c.completed_at at time zone 'UTC')::date - f.first_day) as next_gap
    from first_completion f
    join attempts c on c.guest_id = f.guest_id
      and c.mode = 'daily' and c.state = 'completed'
      and (c.completed_at at time zone 'UTC')::date > f.first_day
    group by f.guest_id, f.first_day
  ),
  per_day as (
    select d::date as day
    from generate_series(current_date - ($1::int), current_date - 1, interval '1 day') d
  )
  select to_char(pd.day, 'YYYY-MM-DD') as day,
    (select count(*) from first_completion f where f.first_day = pd.day)::int as first_time,
    (select count(*) from later_completion l where l.first_day = pd.day and l.next_gap <= 1)::int as d1_returns,
    (select count(*) from later_completion l where l.first_day = pd.day and l.next_gap <= 7)::int as d7_returns,
    coalesce((select s.started from daily_starts s where s.day = pd.day), 0)::int as started,
    coalesce((select f.completed from daily_finishes f where f.day = pd.day), 0)::int as completed,
    (select count(*) from share_results sr
       join attempts a on a.id = sr.attempt_id
       where sr.revoked_at is null
         and (sr.created_at at time zone 'UTC')::date = pd.day)::int as shared,
    (select count(*) from invalid_guess_events i
       where (i.created_at at time zone 'UTC')::date = pd.day)::int as invalid,
    (select count(*) from invalid_guess_events i
       where (i.created_at at time zone 'UTC')::date = pd.day and i.corrected_at is not null)::int as corrected
  from per_day pd
  order by pd.day
`, [windowDays]);

const pct = (n: number, d: number) => (d > 0 ? `${((n / d) * 100).toFixed(1)}%` : "—");
let totalFirst = 0;
let totalD7 = 0;
let totalStarted = 0;
let totalCompleted = 0;
let totalShared = 0;
let totalInvalid = 0;
let totalCorrected = 0;

console.log(`Q45 KPIs — last ${windowDays} days (UTC days)`);
console.log("day         first-time  D1     D7      completion  shares   corrected-invalid");
for (const r of rows.rows) {
  totalFirst += r.first_time;
  totalD7 += r.d7_returns;
  totalStarted += r.started;
  totalCompleted += r.completed;
  totalShared += r.shared;
  totalInvalid += r.invalid;
  totalCorrected += r.corrected;
  console.log(
    `${r.day}  ${String(r.first_time).padStart(4)}       ` +
      `${pct(r.d1_returns, r.first_time).padStart(6)}  ` +
      `${pct(r.d7_returns, r.first_time).padStart(6)}  ` +
      `${pct(r.completed, r.started).padStart(6)}     ` +
      `${pct(r.shared, r.completed).padStart(6)}  ` +
      `${pct(r.corrected, r.invalid).padStart(6)}`,
  );
}

console.log("");
console.log(`totals: ${totalFirst} first-time finishers, D7 ${pct(totalD7, totalFirst)}, ` +
  `completion ${pct(totalCompleted, totalStarted)}, shares/completion ${pct(totalShared, totalCompleted)}, ` +
  `corrected invalid-input ${pct(totalCorrected, totalInvalid)}`);

// Q45: no performance verdict below 100 qualified first-time finishers.
if (totalFirst < 100) {
  console.log("");
  console.log(`NOTE: ${totalFirst} qualified first-time finishers is below the 100-person floor —`);
  console.log("treat every number above as directional only, not a performance verdict.");
  console.log("Starting target once qualified: D7 return >= 20%.");
} else {
  const d7 = (totalD7 / totalFirst) * 100;
  console.log("");
  console.log(`D7 return ${d7.toFixed(1)}% vs 20% starting target: ${d7 >= 20 ? "on target" : "below target"}.`);
}

process.exit(0);
