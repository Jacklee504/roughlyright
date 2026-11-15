import type { Metadata } from "next";
import Link from "next/link";
import { getGuestId } from "@/lib/http/session";
import { utcToday } from "@/lib/domain/calendar";
import { q } from "@/lib/db/client";
import { isPremiumGuest, archiveFloorDate, FREE_ARCHIVE_DAYS } from "@/lib/service/premium";
import PixelSprite from "@/components/pixel/PixelSprite";
import { PLANET, PALETTES } from "@/components/pixel/sprites";

export const metadata: Metadata = {
  title: "Estimation archive",
};

export const dynamic = "force-dynamic";

type Row = { date: string; display_number: number; theme_tag: string | null; state: string | null; score: number | null };

export default async function ArchiveIndexPage() {
  const today = utcToday();
  const guestId = await getGuestId();
  const premium = await isPremiumGuest(guestId);
  const floor = archiveFloorDate(today, premium);

  // Free tier sees only the recent window; premium sees everything.
  const rows = await q<Row>(
    `select p.date::text as date, p.display_number, p.theme_tag, a.state, a.score
     from puzzles p
     left join attempts a on a.puzzle_id = p.id and a.guest_id = $1 and a.state = 'completed'
        and a.mode = (case when p.date = current_date then 'daily' else 'archive' end)
     where p.game_slug = 'estimation' and p.status = 'live' and p.date < $2
       ${floor ? "and p.date >= $3" : ""}
     order by p.date desc`,
    floor ? [guestId ?? "", today, floor] : [guestId ?? "", today],
  );

  const lockedCount = floor
    ? (
        await q<{ n: string }>(
          `select count(*)::text as n from puzzles
           where game_slug = 'estimation' and status = 'live' and date < $1 and date < $2`,
          [floor, today],
        )
      )[0]?.n ?? "0"
    : "0";

  return (
    <main>
      <div className="hero">
        <PixelSprite sprite={PLANET} palette={PALETTES.planet} size={38} className="hero-mascot" />
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
      {floor && Number(lockedCount) > 0 ? (
        <div className="card upsell-card" style={{ marginTop: 14 }}>
          <p style={{ margin: 0 }}>
            🔒 <strong>{lockedCount} more {Number(lockedCount) === 1 ? "date" : "dates"}</strong> hidden —
            the free archive keeps the last {FREE_ARCHIVE_DAYS} days.
          </p>
          <div className="actions" style={{ marginTop: 10 }}>
            <Link className="primary btn" href="/estimation/upgrade">Unlock everything</Link>
          </div>
        </div>
      ) : null}
      <div className="actions">
        <Link className="btn" href="/estimation">Today's daily</Link>
        <Link className="btn" href="/">Home</Link>
      </div>
    </main>
  );
}
