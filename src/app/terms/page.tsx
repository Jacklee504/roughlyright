import type { Metadata } from "next";
import Link from "next/link";
import { CONTACT_EMAIL } from "@/lib/site";

export const metadata: Metadata = {
  title: "Terms & contact",
  description: "The short rules of Roughly Right: submissions, link visibility, misuse and how to reach us.",
};

// Static content; the game pages own the dynamic rendering.
export const dynamic = "force-static";

export default function TermsPage() {
  return (
    <main>
      <div className="hero">
        <h1>
          Terms &amp; <span className="grad-text">contact</span>
        </h1>
        <p className="tagline muted">Short, plain-language rules. Playing the game means agreeing to these.</p>
      </div>

      <div className="card" style={{ marginBottom: 14 }}>
        <h2>Playing &amp; submissions</h2>
        <ul className="muted" style={{ margin: "8px 0 0", paddingLeft: 20 }}>
          <li>One ranked daily attempt per person per day; archive puzzles are unranked practice.</li>
          <li>Guesses you lock in are final — a locked round cannot be re-guessed.</li>
          <li>Don&rsquo;t automate, script or multi-account the game; scores from abuse may be removed.</li>
          <li>Everything here is provided as-is, for fun, with no warranty and no liability.</li>
        </ul>
      </div>

      <div className="card" style={{ marginBottom: 14 }}>
        <h2>Shared links</h2>
        <ul className="muted" style={{ margin: "8px 0 0", paddingLeft: 20 }}>
          <li>Share links show your score out of 500 and which rounds you passed — never the answers.</li>
          <li>Anyone with the link can view it; revoke links anytime from <Link href="/privacy">your privacy page</Link>.</li>
          <li>Links are removed automatically after 12 months of inactivity, or when you delete your data.</li>
        </ul>
      </div>

      <div className="card" style={{ marginBottom: 14 }}>
        <h2>Misuse &amp; reports</h2>
        <p className="muted" style={{ margin: "8px 0 0" }}>
          If a question, answer or dataset looks wrong, use the <strong>report</strong> button on the round — it goes
          straight to the editors. We may remove content, links or access that breaks these rules or the law.
        </p>
      </div>

      <div className="card" style={{ marginBottom: 14 }}>
        <h2>Contact</h2>
        {CONTACT_EMAIL ? (
          <p className="muted" style={{ margin: "8px 0 0" }}>
            Questions about your data or these terms: <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.
          </p>
        ) : (
          <p className="muted" style={{ margin: "8px 0 0" }}>
            There is no support inbox for the game. Content problems: the in-game <strong>report</strong> button.
            Your data: <Link href="/privacy">export or delete it yourself</Link> — no email needed.
          </p>
        )}
        <p className="muted" style={{ marginTop: 8 }}>
          See also <Link href="/privacy">Privacy &amp; your data</Link>.
        </p>
      </div>

      <div className="actions" style={{ marginTop: 14 }}>
        <Link className="btn" href="/estimation">Back to the game</Link>
      </div>
    </main>
  );
}
