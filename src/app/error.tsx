"use client";

import Link from "next/link";
import { useEffect } from "react";
import PixelSprite from "@/components/pixel/PixelSprite";
import { FLASK, PALETTES } from "@/components/pixel/sprites";

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    // Surfaced to server logs via the digest; nothing guest-identifying here.
    console.error("app_error", error.digest ?? error.message);
  }, [error]);

  return (
    <main>
      <section className="hero">
        <PixelSprite sprite={FLASK} palette={PALETTES.flask} size={34} className="hero-mascot" />
        <span className="chip">Equipment fault</span>
        <h1>
          A reading <span className="grad-text">went sideways</span>
        </h1>
        <p className="tagline">
          Something broke while rendering this page. Your streak and today's progress are safe on the server.
        </p>
        <div className="actions">
          <button className="btn" onClick={reset}>Try again</button>
          <Link className="btn" href="/">Home</Link>
        </div>
        {error.digest ? <p className="muted small">Reference: {error.digest}</p> : null}
      </section>
    </main>
  );
}
