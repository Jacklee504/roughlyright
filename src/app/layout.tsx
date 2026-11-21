import type { Metadata, Viewport } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"),
  title: {
    default: "Roughly Right · Close Call",
    template: "%s · Roughly Right",
  },
  description: "Take on the House in five rounds of real-world estimation. Get close, call the range and bet on the final answer.",
  openGraph: {
    type: "website",
    siteName: "Roughly Right",
    title: "Close Call by Roughly Right",
    description: "Five rounds of real-world estimation against the House. One final wager.",
    images: [{ url: "/estimation/close-call/opengraph-image", width: 1200, height: 630, alt: "Close Call by Roughly Right" }],
  },
  twitter: {
    card: "summary_large_image",
  },
  manifest: "/manifest.webmanifest",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#0b1916",
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
          <nav aria-label="Main">
            <Link href="/estimation">Today</Link>
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
