import type { Metadata, Viewport } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"),
  title: {
    default: "Roughly Right — daily estimation games",
    template: "%s · Roughly Right",
  },
  description: "Make five real-world estimates. Get closer to earn more points. A new puzzle every day at 00:00 UTC.",
  openGraph: {
    type: "website",
    siteName: "Roughly Right",
    title: "Roughly Right — daily estimation games",
    description: "Five real-world estimates a day. Get closer to earn more points. No timer, no signup.",
    images: [{ url: "/og.png", width: 1200, height: 630, alt: "Roughly Right — a daily estimation game" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Roughly Right — daily estimation games",
    description: "Five real-world estimates a day. Get closer to earn more points. No timer, no signup.",
    images: ["/og.png"],
  },
  manifest: "/manifest.webmanifest",
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
