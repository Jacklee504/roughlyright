import type { Metadata } from "next";
import Link from "next/link";
import { getGuestId } from "@/lib/http/session";
import { utcToday } from "@/lib/domain/calendar";
import { q } from "@/lib/db/client";
import LabGrid from "@/components/LabGrid";
import AnimatedSprite from "@/components/pixel/AnimatedSprite";
import { PALETTES } from "@/components/pixel/sprites";

export const metadata: Metadata = {
  title: "Estimation archive",
};

export const dynamic = "force-dynamic";

type Row = { date: string; display_number: number; theme_tag: string | null; state: string | null; score: number | null };

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

  const rows = await q<Row>(
    `select p.date::text as date, p.display_number, p.theme_tag, a.state, a.score
     from puzzles p
     left join attempts a on a.puzzle_id = p.id and a.guest_id = $1 and a.state = 'completed'
        and a.mode = (case when p.date = current_date then 'daily' else 'archive' end)
     where p.game_slug = 'estimation' and p.status = 'live' and p.date < $2
     order by p.date desc`,
    [guestId ?? "", today],
  );

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
    <main>
      <LabGrid density={32} />
      <div className="hero">
        <AnimatedSprite name="oscilloscope" palette={PALETTES.oscilloscope} size={38} className="hero-mascot" />
        <span className="chip">Historical calibration records</span>
        <h1>
          Estimation <span className="grad-text">archive</span>
        </h1>
        <p className="tagline muted">
          Every released date before today. Completed dates open their recap; missed dates can be
          played once as unranked archive puzzles. Archive runs never affect your daily streak.
        </p>
        <div className="pills">
          <span className="pill">📅 {rows.length} released</span>
          <span className="pill">✓ {played} played</span>
          <span className="pill">↺ unranked replays</span>
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="card">
          <p role="status" className="muted">No released dates yet — today is the beginning of the log.</p>
        </div>
      ) : (
        groups.map((g) => (
          <section className="card" key={g.key} aria-labelledby={`month-${g.key}`}>
            <h2 id={`month-${g.key}`}>{g.label}</h2>
            <ul className="day-grid">
              {g.days.map((r) => {
                const done = r.state === "completed";
                const score = r.score ?? 0;
                return (
                  <li key={r.date}>
                    <Link
                      className={`day-tile${done ? " played" : ""}`}
                      href={`/estimation/archive/${r.date}`}
                      aria-label={`Puzzle ${r.display_number} from ${dayLabel(r.date)}${
                        done ? `, played: ${score} of 500` : ", not played"
                      }`}
                    >
                      <span className="day-top">
                        <span className="day-num">#{r.display_number}</span>
                        {done ? <span className="day-check">✓ {score}</span> : <span className="day-play">Play →</span>}
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
        {rows.length > 0 ? (
          <Link
            className="primary"
            href={`/estimation/archive/${rows[Math.floor(Math.random() * rows.length)].date}`}
          >
            🎲 Play random past puzzle
          </Link>
        ) : null}
        <Link className="btn" href="/estimation">Today&apos;s daily</Link>
      </div>
    </main>
  );
}
