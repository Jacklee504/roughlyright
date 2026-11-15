import type { Metadata } from "next";
import Link from "next/link";
import { getGuestId } from "@/lib/http/session";
import { isPremiumGuest, FREE_ARCHIVE_DAYS } from "@/lib/service/premium";
import RedeemPremium from "@/components/RedeemPremium";
import PixelSprite from "@/components/pixel/PixelSprite";
import { TROPHY, ROCKET, SPARKLE, PALETTES } from "@/components/pixel/sprites";

export const metadata: Metadata = { title: "Upgrade" };
export const dynamic = "force-dynamic";

const PERKS = [
  {
    sprite: TROPHY,
    palette: PALETTES.trophy,
    title: "Full archive",
    text: `Free players can replay the last ${FREE_ARCHIVE_DAYS} days. Premium opens every published date, forever.`,
  },
  {
    sprite: SPARKLE,
    palette: PALETTES.star,
    title: "Insights dashboard",
    text: "Your score history, mark distribution, category strengths and personal records — all in one place.",
  },
  {
    sprite: ROCKET,
    palette: PALETTES.rocket,
    title: "Light mode",
    text: "A premium daylight theme. Flip between the observatory dark and a clean light look any time.",
  },
] as const;

export default async function UpgradePage() {
  const guestId = await getGuestId();
  const premium = await isPremiumGuest(guestId);

  return (
    <main>
      <div className="hero">
        <PixelSprite sprite={TROPHY} palette={PALETTES.trophy} size={44} className="hero-mascot" />
        <span className="chip">Roughly Right Premium</span>
        <h1>
          Go <span className="grad-text">deeper</span>
        </h1>
        <p className="tagline muted">
          The daily game stays free — five rounds a day, forever. Premium adds depth around it.
        </p>
      </div>

      {premium ? (
        <div className="card premium-active">
          <p className="verdict-row" style={{ margin: 0 }}>
            <PixelSprite sprite={TROPHY} palette={PALETTES.trophy} size={22} />
            <span className="verdict-text">Premium is active on this device.</span>
          </p>
          <p className="muted small" style={{ marginTop: 8 }}>
            Full archive, the insights dashboard and the light theme are unlocked. Your badge and
            theme switch live in the header.
          </p>
          <div className="actions">
            <Link className="btn" href="/estimation/insights">Open Insights</Link>
            <Link className="btn" href="/estimation/archive">Browse the archive</Link>
          </div>
        </div>
      ) : (
        <>
          <section className="perk-grid" aria-label="Premium features">
            {PERKS.map((p) => (
              <div className="perk" key={p.title}>
                <PixelSprite sprite={[...p.sprite]} palette={p.palette} size={26} />
                <strong>{p.title}</strong>
                <span>{p.text}</span>
              </div>
            ))}
          </section>

          <div className="card">
            <h2>Get Premium</h2>
            <p className="muted">
              Online checkout is on the roadmap. For now access is via upgrade codes — redeem one
              below and it sticks to this device&apos;s guest profile.
            </p>
            <RedeemPremium />
            <p className="muted small" style={{ marginTop: 10 }}>
              Running the game locally? Owners can unlock everything with{" "}
              <code>npm run dev:premium</code>.
            </p>
          </div>
        </>
      )}

      <div className="actions">
        <Link className="btn" href="/">Home</Link>
        <Link className="btn" href="/estimation">Back to today&apos;s game</Link>
      </div>
    </main>
  );
}
