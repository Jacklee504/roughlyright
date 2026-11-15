import type { Metadata, Viewport } from "next";
import Link from "next/link";
import "./globals.css";
import { getGuestId } from "@/lib/http/session";
import { isPremiumGuest, premiumUnlockedByEnv } from "@/lib/service/premium";
import ThemeToggle from "@/components/ThemeToggle";

export const metadata: Metadata = {
  title: {
    default: "Roughly Right — daily estimation games",
    template: "%s · Roughly Right",
  },
  description: "Make five real-world estimates. Get closer to earn more points. A new puzzle every day at 00:00 UTC.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#060a17",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const guestId = await getGuestId();
  // Header renders in every request; skip the DB hit when the env unlock is on.
  const premium = premiumUnlockedByEnv() ? !!guestId : await isPremiumGuest(guestId);

  return (
    <html lang="en">
      <head>
        {/* Apply a persisted premium theme before first paint (no flash). */}
        <script
          dangerouslySetInnerHTML={{
            __html: `try{if(localStorage.getItem("rr_theme")==="light")document.documentElement.dataset.theme="light"}catch(e){}`,
          }}
        />
      </head>
      <body>
        <header className="site">
          <Link className="brand" href="/">
            <span className="logo" aria-hidden="true">RR</span>
            Roughly Right
          </Link>
          <nav aria-label="Games">
            {/* Partial rollout: only released games appear in navigation. */}
            <Link href="/estimation">Estimation</Link>
            <Link href="/estimation/insights">Insights</Link>
          </nav>
          {premium ? (
            <span className="premium-badge" title="Premium">
              ★
            </span>
          ) : null}
          {premium ? <ThemeToggle /> : null}
        </header>
        {children}
      </body>
    </html>
  );
}
