import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
import { q } from "@/lib/db/client";
import PrivacyControls from "@/components/PrivacyControls";

export const metadata: Metadata = {
  title: "Privacy & your data",
  description: "What Roughly Right stores, and how to export or delete it.",
};

export const dynamic = "force-dynamic";

export default async function PrivacyPage() {
  const jar = await cookies();
  const guestId = jar.get("rr_guest")?.value ?? null;
  const hasData = guestId
    ? (await q<{ n: string }>(`select count(*)::text as n from guests where id = $1`, [guestId]))[0]?.n === "1"
    : false;

  return (
    <main>
      <div className="hero">
        <h1>
          Privacy &amp; <span className="grad-text">your data</span>
        </h1>
        <p className="tagline muted">A short, plain-language summary. No account, no email, no tracking.</p>
      </div>

      <div className="card" style={{ marginBottom: 14 }}>
        <h2>What we store</h2>
        <ul className="muted" style={{ margin: "8px 0 0", paddingLeft: 20 }}>
          <li>A random <strong>guest id</strong> in a cookie — no name, email or sign-up.</li>
          <li>Your <strong>game attempts</strong>: which daily you played, the guesses you locked in, your scores and streaks.</li>
          <li>Any <strong>share links</strong> you created for a finished result.</li>
          <li><strong>Anonymous daily totals</strong> (how many people played) with nothing that identifies you.</li>
          <li>Your <strong>Close Call record, Scale Run progress and Lab best scores</strong> stay in this browser. The controls below can clear that progress. Your Close Call sound preference stays on this device.</li>
          <li>A <strong>Close Call challenge link</strong> carries your score target and episode. Anyone with the link can try that episode.</li>
        </ul>
        <p className="muted" style={{ marginTop: 10 }}>
          Content-error reports you may have sent are separate and are not exported here. Play data is
          automatically removed 12&nbsp;months after your last game.
        </p>
      </div>

      <PrivacyControls hasData={hasData} />

      <div className="actions" style={{ marginTop: 14 }}>
        <Link className="btn" href="/estimation">Back to the game</Link>
      </div>
    </main>
  );
}
