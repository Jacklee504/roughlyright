import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
import { getGuestId } from "@/lib/http/session";
import { getSharePayload } from "@/lib/service/share";
import { q } from "@/lib/db/client";

export const dynamic = "force-dynamic";

const GUEST_COOKIE = "rr_guest";

// Spoiler-free metadata: prompts, answers, guesses and solution facts are omitted.
export async function generateMetadata({ params }: { params: Promise<{ token: string }> }): Promise<Metadata> {
  const { token } = await params;
  return {
    title: "Shared estimation result",
    description: "A shared result from Roughly Right — Estimation. Score out of 500.",
    robots: { index: false },
  };
}

export default async function ResultPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  const jar = await cookies();
  const viewerGuestId = jar.get(GUEST_COOKIE)?.value ?? null;

  // Comparison unlocks only after the viewer completed the same puzzle (either mode).
  let viewerCompletedPuzzleId: string | null = null;
  if (viewerGuestId) {
    const rows = await q<{ puzzle_id: string }>(
      `select a.puzzle_id from attempts a join share_results s on s.attempt_id = a.id
       where s.token = $1 and a.guest_id = $2 and a.state = 'completed' limit 1`,
      [token, viewerGuestId],
    );
    viewerCompletedPuzzleId = rows[0]?.puzzle_id ?? null;
  }

  const result = await getSharePayload(token, viewerGuestId, viewerCompletedPuzzleId);
  const viewerGuest = await getGuestId();

  if (!result.found) {
    // Neutral page for invalid, revoked and unknown tokens.
    return (
      <main>
        <h1>Result unavailable</h1>
        <p role="alert" className="muted">
          This result link doesn't exist, was revoked, or is no longer available.
        </p>
        <div className="actions">
          <Link className="btn" href="/estimation">Play Estimation</Link>
          <Link className="btn" href="/">Home</Link>
        </div>
      </main>
    );
  }

  const p = result.payload;
  const ownLink = viewerGuest && viewerGuest === (await ownerOf(result.attemptId));
  const frac = p.maxTotal > 0 ? Math.max(0, Math.min(1, p.total / p.maxTotal)) : 0;
  const ringR = 70;
  const ringC = 2 * Math.PI * ringR;

  return (
    <main>
      <div className="card result-hero">
        <span className="chip">{p.mode === "daily" ? "Daily" : "Archive · unranked"}</span>
        <svg className="score-ring" viewBox="0 0 160 160" role="img" aria-label={`Score ${p.total} of ${p.maxTotal}`}>
          <defs>
            <linearGradient id="ringGradShare" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#6ea8ff" />
              <stop offset="55%" stopColor="#8f7bff" />
              <stop offset="100%" stopColor="#b48cff" />
            </linearGradient>
          </defs>
          <circle cx="80" cy="80" r={ringR} fill="none" stroke="rgba(148,170,255,0.12)" strokeWidth="11" />
          <circle
            cx="80"
            cy="80"
            r={ringR}
            fill="none"
            stroke="url(#ringGradShare)"
            strokeWidth="11"
            strokeLinecap="round"
            strokeDasharray={ringC}
            strokeDashoffset={ringC * (1 - frac)}
            transform="rotate(-90 80 80)"
          />
        </svg>
        <div className="ring-label">
          <div>
            <div className="total">
              {p.total}
              <span className="denom"> / {p.maxTotal}</span>
            </div>
          </div>
        </div>
        <p className="sub">
          Estimation #{p.displayNumber} · {p.puzzleDate}
        </p>
        <div className="marks" role="list" aria-label="Round marks">
          {p.marks.map((m) => (
            <span role="listitem" key={m.ordinal} className={`mark mark-${m.mark.replace(/\s+/g, "-")}`}>
              {m.mark}
            </span>
          ))}
        </div>
        <p className="muted small">Marks only — prompts, answers and guesses stay private.</p>
      </div>

      {p.comparison ? (
        <div className="card">
          <h2>Per-question comparison</h2>
          <p className="muted small">You've finished the same puzzle, so you can compare round by round.</p>
          <table className="archive">
            <thead>
              <tr>
                <th scope="col">Round</th>
                <th scope="col">This result</th>
                <th scope="col">You</th>
              </tr>
            </thead>
            <tbody>
              {p.comparison.map((c) => (
                <tr key={c.ordinal}>
                  <td>Round {c.ordinal}</td>
                  <td>{c.owner.points} pts · {c.owner.mark}</td>
                  <td>{c.viewer.points} pts · {c.viewer.mark}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : p.comparisonEnabled ? (
        <p className="muted">
          This player enabled per-question comparison — it unlocks if you finish the same puzzle
          first.
        </p>
      ) : null}

      <div className="actions">
        <Link className="btn" href="/estimation">Play today's Estimation</Link>
        <Link className="btn" href="/">Home</Link>
      </div>
      {ownLink ? (
        <p className="muted small">
          This is your result link. Anyone with the link can view it.
        </p>
      ) : null}
    </main>
  );
}

async function ownerOf(attemptId: string): Promise<string | null> {
  const rows = await q<{ guest_id: string }>(`select guest_id from attempts where id = $1`, [attemptId]);
  return rows[0]?.guest_id ?? null;
}
