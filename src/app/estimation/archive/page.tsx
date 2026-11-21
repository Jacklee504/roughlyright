import type { Metadata } from "next";
import Link from "next/link";
import { getGuestId } from "@/lib/http/session";
import { utcToday } from "@/lib/domain/calendar";
import { now } from "@/lib/domain/clock";
import { q } from "@/lib/db/client";
import { freeArchiveDates } from "@/lib/service/attempts";
import { featuresFor, getTier } from "@/lib/service/tiers";

export const metadata: Metadata = {
  title: "Estimation archive",
};

export const dynamic = "force-dynamic";

type Row = { date: string; display_number: number; theme_tag: string | null; state: string | null; score: number | null; had_daily: boolean };

function dayLabel(date: string): string {
  return new Date(`${date}T00:00:00Z`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

function monthLabel(date: string): string {
  return new Date(`${date}T00:00:00Z`).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

export default async function ArchiveIndexPage() {
  const today = utcToday();
  const guestId = await getGuestId();

  const [rows, tier] = await Promise.all([
    q<Row>(
      `select p.date::text as date, p.display_number, p.theme_tag,
              coalesce(d.state, a.state) as state, coalesce(d.score, a.score) as score,
              d0.id is not null as had_daily
       from puzzles p
       left join attempts d0 on d0.puzzle_id = p.id and d0.guest_id = $1 and d0.mode = 'daily'
       left join attempts d on d.id = d0.id and
         (d0.state = 'completed' or (d0.state = 'active' and d0.daily_expiry > $3))
       left join attempts a on a.puzzle_id = p.id and a.guest_id = $1 and a.mode = 'archive'
       where p.game_slug = 'estimation' and p.status = 'live' and p.date < $2
       order by p.date desc`,
      [guestId, today, now()],
    ),
    getTier(guestId),
  ]);
  const archiveDays = featuresFor(tier).archiveDays;
  const restricted = Number.isFinite(archiveDays);
  const recent = restricted ? new Set(await freeArchiveDates("estimation", today)) : null;
  const canOpen = (row: Row) => !!row.state || row.had_daily || !recent || recent.has(row.date);
  const unplayed = rows.filter((row) => canOpen(row) && row.state !== "completed");
  const random = unplayed.length ? unplayed[Math.floor(Math.random() * unplayed.length)] : null;

  const played = rows.filter((r) => r.state === "completed").length;

  // Group the log by month, newest first.
  const groups: { key: string; label: string; days: Row[] }[] = [];
  for (const r of rows) {
    const key = r.date.slice(0, 7);
    const last = groups[groups.length - 1];
    if (last && last.key === key) last.days.push(r);
    else groups.push({ key, label: monthLabel(r.date), days: [r] });
  }

  return (
    <main className="play-shell">
      <div className="game-heading">
        <div>
          <p className="eyebrow">{played} of {rows.length} complete</p>
          <h1>Puzzle archive</h1>
        </div>
        {random ? <Link className="btn primary" href={`/estimation/archive/${random.date}`}>Surprise me <span aria-hidden="true">→</span></Link> : null}
      </div>
      <p className="muted">
        Catch up on past puzzles or revisit your results. Archive runs leave your daily streak intact.
        {restricted ? ` The ${archiveDays} most recent past puzzles are open to everyone.` : ""}
      </p>

      {rows.length === 0 ? (
        <div className="card">
          <p role="status" className="muted">Past puzzles will appear here after the first daily closes.</p>
        </div>
      ) : (
        groups.map((g) => (
          <section className="card" key={g.key} aria-labelledby={`month-${g.key}`}>
            <h2 id={`month-${g.key}`}>{g.label}</h2>
            <ul className="day-grid">
              {g.days.map((r) => {
                const done = r.state === "completed";
                const score = r.score ?? 0;
                if (!canOpen(r)) return (
                  <li key={r.date} className="day-tile locked">
                    <span className="day-top"><span className="day-num">#{r.display_number}</span><span className="day-date">Locked</span></span>
                    <span className="day-date">{dayLabel(r.date)}</span>
                    {r.theme_tag ? <span className="day-tag">{r.theme_tag}</span> : null}
                  </li>
                );
                const label = done ? `Score ${score} of 500` : r.state === "active" ? "Continue" : "Play";
                return (
                  <li key={r.date}>
                    <Link
                      className={`day-tile${done ? " played" : ""}`}
                      href={`/estimation/archive/${r.date}`}
                      aria-label={`Puzzle ${r.display_number} from ${dayLabel(r.date)} · ${label}`}
                    >
                      <span className="day-top">
                        <span className="day-num">#{r.display_number}</span>
                        {done ? <span className="day-check">✓ {score}</span> : <span className="day-play">{label} →</span>}
                      </span>
                      <span className="day-date">{dayLabel(r.date)}</span>
                      {r.theme_tag ? <span className="day-tag">{r.theme_tag}</span> : null}
                      <span className="day-bar" aria-hidden="true">
                        <span style={{ width: `${Math.min(100, Math.round((score / 500) * 100))}%` }} />
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </section>
        ))
      )}

      <div className="actions">
        <Link className="btn" href="/estimation/warm-up">Play a warm-up</Link>
        <Link className="btn" href="/estimation">Today&apos;s daily</Link>
      </div>
    </main>
  );
}
