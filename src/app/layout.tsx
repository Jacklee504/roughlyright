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
  themeColor: "#0e1220",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <header className="site">
          <Link className="brand" href="/">Roughly Right</Link>
          <nav aria-label="Games">
            {/* Partial rollout: only released games appear in navigation. */}
            <Link href="/estimation">Estimation</Link>
          </nav>
        </header>
        {children}
      </body>
    </html>
  );
}
