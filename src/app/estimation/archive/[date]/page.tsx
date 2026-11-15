import type { Metadata } from "next";
import Link from "next/link";
import EstimationGame from "@/components/EstimationGame";
import { utcToday } from "@/lib/domain/calendar";
import { getPuzzleByDate } from "@/lib/service/puzzles";

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

  return <EstimationGame mode="archive" date={date} />;
}
