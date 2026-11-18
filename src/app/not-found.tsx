import Link from "next/link";
import PixelSprite from "@/components/pixel/PixelSprite";
import { SPARKLE, PALETTES } from "@/components/pixel/sprites";

export default function NotFound() {
  return (
    <main>
      <section className="hero">
        <PixelSprite sprite={SPARKLE} palette={PALETTES.star} size={34} className="hero-mascot" />
        <span className="chip">Lost in space</span>
        <h1>
          404 — <span className="grad-text">off the chart</span>
        </h1>
        <p className="tagline">This page isn't on any calibration sheet. The daily, however, is exactly where you left it.</p>
        <div className="actions">
          <Link className="btn" href="/">Home</Link>
          <Link className="btn" href="/estimation">Play today's Estimation</Link>
        </div>
      </section>
    </main>
  );
}
