import type { Metadata } from "next";
import Link from "next/link";
import EstimationGame from "@/components/EstimationGame";
import { utcToday } from "@/lib/domain/calendar";
import { getPuzzleByDate } from "@/lib/service/puzzles";
import { getGuestId } from "@/lib/http/session";
import { isPremiumGuest, archiveFloorDate } from "@/lib/service/premium";
import PixelSprite from "@/components/pixel/PixelSprite";
import { PLANET, PALETTES } from "@/components/pixel/sprites";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ date: string }> }): Promise<Metadata> {
  const { date } = await params;
  return { title: `Estimation archive — ${date}` };
}

export default async function ArchiveDatePage({ params }: { params: Promise<{ date: string }> }) {
  const { date } = await params;
  const valid = /^\d{4}-\d{2}-\d{2}$/.test(date) && date < utcToday();
  const puzzle = valid ? await getPuzzleByDate("estimation", date) : null;

  if (!puzzle) {
    return (
      <main>
        <h1>Not available</h1>
        <p role="alert" className="muted">
          That date has no released puzzle, or it isn't openable in the archive.
        </p>
        <div className="actions">
          <Link className="btn" href="/estimation/archive">Archive</Link>
          <Link className="btn" href="/estimation">Today's daily</Link>
        </div>
      </main>
    );
  }

  // Free tier can only replay the recent window; older dates are premium.
  const guestId = await getGuestId();
  const premium = await isPremiumGuest(guestId);
  const floor = archiveFloorDate(utcToday(), premium);
  if (floor && date < floor) {
    return (
      <main>
        <div className="hero">
          <PixelSprite sprite={PLANET} palette={PALETTES.ghost} size={40} className="hero-mascot" />
          <span className="chip">Premium</span>
          <h1>
            Locked <span className="grad-text">archive</span>
          </h1>
        </div>
        <div className="card">
          <p>
            Puzzle #{puzzle.display_number} ({date}) is outside the free {""}
            archive window. Premium unlocks every published date, unranked replays included.
          </p>
          <div className="actions">
            <Link className="primary btn" href="/estimation/upgrade">Unlock everything</Link>
            <Link className="btn" href="/estimation/archive">Back to archive</Link>
          </div>
        </div>
      </main>
    );
  }

  return <EstimationGame mode="archive" date={date} />;
}
