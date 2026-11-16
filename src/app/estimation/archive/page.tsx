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
          Released dates before today. Completed dates open their recap; missed dates can be played
          once as unranked archive puzzles. Archive runs never affect your daily streak.
        </p>
      </div>
      {rows.length === 0 ? (
        <div className="card">
          <p role="status" className="muted">No released dates yet.</p>
        </div>
      ) : (
        <table className="archive">
          <thead>
            <tr>
              <th scope="col">Puzzle</th>
              <th scope="col">Date</th>
              <th scope="col">Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.date}>
                <td>
                  <Link href={`/estimation/archive/${r.date}`}>#{r.display_number}{r.theme_tag ? ` · ${r.theme_tag}` : ""}</Link>
                </td>
                <td>{r.date}</td>
                <td>{r.state === "completed" ? <span className="pill">✓ {r.score}/500</span> : <span className="muted">Not played</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
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
        <Link className="btn" href="/estimation">Today's daily</Link>
        <Link className="btn" href="/">Home</Link>
      </div>
    </main>
  );
}
