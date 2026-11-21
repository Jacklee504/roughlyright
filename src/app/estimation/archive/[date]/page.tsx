import type { Metadata } from "next";
import Link from "next/link";
import EstimationGame from "@/components/EstimationGame";
import { isUtcDate, utcToday } from "@/lib/domain/calendar";
import { getPuzzleByDate } from "@/lib/service/puzzles";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ date: string }> }): Promise<Metadata> {
  const { date } = await params;
  return { title: `Estimation archive — ${date}` };
}

export default async function ArchiveDatePage({ params }: { params: Promise<{ date: string }> }) {
  const { date } = await params;
  const valid = isUtcDate(date) && date < utcToday();
  const puzzle = valid ? await getPuzzleByDate("estimation", date) : null;

  if (!puzzle) {
    return (
      <main>
        <div className="hero">
          <span className="chip">Off the log</span>
          <h1>Not <span className="grad-text">available</span></h1>
          <p className="tagline muted">
            That date has no released puzzle, or it isn&apos;t openable in the archive.
          </p>
        </div>
        <div className="actions">
          <Link className="btn" href="/estimation/archive">Back to the log</Link>
          <Link className="btn" href="/estimation">Today&apos;s daily</Link>
        </div>
      </main>
    );
  }

  return <EstimationGame mode="archive" date={date} />;
}
