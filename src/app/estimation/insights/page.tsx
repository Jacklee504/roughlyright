import type { Metadata } from "next";
import Link from "next/link";
import { getGuestId } from "@/lib/http/session";
import { isPremiumGuest } from "@/lib/service/premium";
import { computeStreaks } from "@/lib/service/stats";
import { q } from "@/lib/db/client";
import PixelSprite from "@/components/pixel/PixelSprite";
import { TROPHY, SPARKLE, PALETTES } from "@/components/pixel/sprites";

export const metadata: Metadata = { title: "Insights" };
export const dynamic = "force-dynamic";

const MARK_COLORS: Record<string, string> = {
  Exact: "var(--good)",
  Close: "var(--good)",
  "In range": "var(--warn)",
  Far: "var(--bad)",
  Pass: "var(--text-faint)",
};

export default async function InsightsPage() {
  const guestId = await getGuestId();
  const premium = await isPremiumGuest(guestId);

  if (!premium) {
    return (
      <main>
        <div className="hero">
          <PixelSprite sprite={SPARKLE} palette={PALETTES.ghost} size={40} className="hero-mascot" />
          <span className="chip">Premium</span>
          <h1>
            Your <span className="grad-text">Insights</span>
          </h1>
          <p className="tagline muted">
            Score history, mark distribution, category strengths and personal records.
          </p>
        </div>
        <div className="card locked-card">
          <h2>🔒 This dashboard is part of Premium</h2>
          <ul className="insights-teaser">
            <li>Every daily score on one chart — see your trend, not just today.</li>
            <li>How your guesses land: Exact vs Close vs Far, all time.</li>
            <li>Which categories you ace (and which guess-back).</li>
            <li>Streak records and personal bests.</li>
          </ul>
          <div className="actions">
            <Link className="primary btn" href="/estimation/upgrade">Unlock with Premium</Link>
            <Link className="btn" href="/estimation">Back to the game</Link>
          </div>
        </div>
      </main>
    );
  }

  if (!guestId) return null;

  const [history, marks, categories, streak] = await Promise.all([
    q<{ date: string; display_number: number; score: number; mode: string }>(
      `select p.date::text as date, p.display_number, a.score, a.mode
       from attempts a join puzzles p on p.id = a.puzzle_id
       where a.guest_id = $1 and a.state = 'completed' and p.game_slug = 'estimation'
       order by p.date desc limit 30`,
      [guestId],
    ),
    q<{ mark: string; n: string }>(
      `select r.mark, count(*)::text as n
       from attempt_rounds r
       join attempts a on a.id = r.attempt_id
       join puzzles p on p.id = a.puzzle_id
       where a.guest_id = $1 and a.state = 'completed' and p.game_slug = 'estimation' and r.mark is not null
       group by r.mark`,
      [guestId],
    ),
    q<{ category: string; avg_pts: string; n: string }>(
      `select pr.category, round(avg(r.points), 1)::text as avg_pts, count(*)::text as n
       from attempt_rounds r
       join attempts a on a.id = r.attempt_id
       join prompt_revisions pr on pr.revision_id = r.revision_id
       join puzzles p on p.id = a.puzzle_id
       where a.guest_id = $1 and a.state = 'completed' and p.game_slug = 'estimation' and r.outcome = 'scored'
       group by pr.category
       order by avg(r.points) desc`,
      [guestId],
    ),
    computeStreaks("estimation", guestId),
  ]);

  const totalRounds = marks.reduce((s, m) => s + Number(m.n), 0);
  const scores = [...history].reverse();
  const maxScore = 500;
  const best = scores.length > 0 ? Math.max(...scores.map((s) => s.score)) : 0;
  const avg = scores.length > 0 ? Math.round(scores.reduce((s, r) => s + r.score, 0) / scores.length) : 0;

  return (
    <main>
      <div className="hero">
        <PixelSprite sprite={SPARKLE} palette={PALETTES.star} size={40} className="hero-mascot" />
        <span className="chip">Premium</span>
        <h1>
          Your <span className="grad-text">Insights</span>
        </h1>
        <div className="pills">
          <span className="pill">🔥 {streak.current} streak · best {streak.best}</span>
          <span className="pill">📊 Avg {avg}/500</span>
          <span className="pill">🏆 Best {best}/500</span>
        </div>
      </div>

      <section className="card" aria-label="Score history">
        <h2>Last {scores.length || 0} games</h2>
        {scores.length === 0 ? (
          <p className="muted">Complete a daily to start your history.</p>
        ) : (
          <div className="spark" role="img" aria-label="Score history, most recent right">
            {scores.map((s) => (
              <div
                key={s.date + s.mode}
                className="spark-bar"
                title={`${s.date} · ${s.score}/500`}
                style={{ height: `${Math.max(4, Math.round((s.score / maxScore) * 100))}%` }}
              />
            ))}
          </div>
        )}
        {scores.length > 0 ? <p className="muted small">Oldest → newest · out of 500</p> : null}
      </section>

      <section className="card" aria-label="Mark distribution">
        <h2>How your guesses land</h2>
        {totalRounds === 0 ? (
          <p className="muted">No scored rounds yet.</p>
        ) : (
          <div className="mark-dist">
            {marks
              .slice()
              .sort((a, b) => Number(b.n) - Number(a.n))
              .map((m) => (
                <div key={m.mark} className="mark-row">
                  <span className="mark-label">{m.mark}</span>
                  <div className="mark-track">
                    <div
                      className="mark-fill"
                      style={{
                        width: `${Math.round((Number(m.n) / totalRounds) * 100)}%`,
                        background: MARK_COLORS[m.mark] ?? "var(--accent)",
                      }}
                    />
                  </div>
                  <span className="muted small">{Math.round((Number(m.n) / totalRounds) * 100)}%</span>
                </div>
              ))}
          </div>
        )}
      </section>

      <section className="card" aria-label="Category performance">
        <h2>Category strengths</h2>
        {categories.length === 0 ? (
          <p className="muted">Play a few days to unlock this breakdown.</p>
        ) : (
          <table className="archive">
            <thead>
              <tr>
                <th scope="col">Category</th>
                <th scope="col">Rounds</th>
                <th scope="col">Avg pts</th>
              </tr>
            </thead>
            <tbody>
              {categories.map((c) => (
                <tr key={c.category}>
                  <td style={{ textTransform: "capitalize" }}>{c.category}</td>
                  <td>{c.n}</td>
                  <td>{c.avg_pts}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <p className="muted small" style={{ textAlign: "center", marginTop: 14 }}>
        <PixelSprite sprite={TROPHY} palette={PALETTES.trophy} size={14} /> Premium feature —
        thanks for supporting the game. <Link href="/estimation/upgrade">Manage</Link>
      </p>
    </main>
  );
}
