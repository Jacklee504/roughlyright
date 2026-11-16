import type { Metadata, Viewport } from "next";
import Link from "next/link";
import "./globals.css";

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

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
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
        </header>
        {children}
        <footer className="site-footer" style={{ textAlign: "center", padding: "28px 16px 40px", fontSize: "0.85rem" }}>
          <span className="muted">
            <Link href="/privacy">Privacy</Link>
            {" · "}
            <Link href="/terms">Terms &amp; contact</Link>
          </span>
        </footer>
      </body>
    </html>
  );
}
