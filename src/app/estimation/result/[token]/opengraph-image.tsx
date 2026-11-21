import { ImageResponse } from "next/og";
import { getSharePayload } from "@/lib/service/share";
import { PALETTES, TROPHY } from "@/components/pixel/sprites";

export const dynamic = "force-dynamic";
export const alt = "A spoiler-free Roughly Right estimation result";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const MARK_STYLE: Record<string, { bg: string; border: string; fg: string }> = {
  Exact: { bg: "rgba(95,227,161,0.18)", border: "#5fe3a1", fg: "#b9ffe8" },
  Close: { bg: "rgba(95,227,161,0.10)", border: "rgba(95,227,161,0.55)", fg: "#9ff0cf" },
  "In range": { bg: "rgba(255,207,92,0.16)", border: "#ffcf5c", fg: "#ffe9a3" },
  Far: { bg: "rgba(255,125,138,0.15)", border: "#ff7d8a", fg: "#ffb3bb" },
  Pass: { bg: "rgba(148,170,255,0.10)", border: "rgba(148,170,255,0.45)", fg: "#c7d0ea" },
};

const MARK_ICONS: Record<string, string> = {
  Exact: "◎",
  Close: "✓",
  "In range": "≈",
  Far: "✗",
  Pass: "–",
};

/** Pixel sprites are drawn with flex cells so Satori needs no SVG support. */
function PixelArt({ sprite, palette, scale }: { sprite: string[]; palette: Record<string, string>; scale: number }) {
  return (
    <div style={{ display: "flex", flexDirection: "column" }}>
      {sprite.map((row, y) => (
        <div key={y} style={{ display: "flex" }}>
          {row.split("").map((ch, x) => (
            <div
              key={x}
              style={{ width: scale, height: scale, background: palette[ch] ?? "transparent" }}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

function verdict(total: number): string {
  if (total >= 450) return "National standard calibration";
  if (total >= 350) return "Laboratory grade accuracy";
  if (total >= 200) return "Within empirical tolerance";
  return "Tomorrow is another calibration run";
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        padding: "52px 64px 44px",
        background: "#070c1a",
        color: "#eaf0ff",
        fontFamily: "sans-serif",
        position: "relative",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          position: "absolute",
          inset: 0,
          backgroundImage:
            "linear-gradient(rgba(148,170,255,0.07) 1px, transparent 1px), linear-gradient(90deg, rgba(148,170,255,0.07) 1px, transparent 1px)",
          backgroundSize: "48px 48px",
        }}
      />
      {children}
    </div>
  );
}

export default async function Image({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  let payload: Awaited<ReturnType<typeof getSharePayload>> | null = null;
  try {
    payload = await getSharePayload(token, null, null);
  } catch {
    payload = null;
  }

  if (!payload || !payload.found) {
    return new ImageResponse(
      (
        <Shell>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <PixelArt sprite={TROPHY} palette={PALETTES.trophy} scale={4} />
            <span style={{ fontSize: 28, letterSpacing: 4, color: "#8ab4ff", fontWeight: 700 }}>
              ROUGHLY RIGHT
            </span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <span style={{ fontSize: 76, fontWeight: 800, lineHeight: 1.05 }}>
              A shared estimation result
            </span>
            <span style={{ fontSize: 32, color: "#9aa7c7" }}>
              Five real-world estimates a day. Marks are public; answers stay private.
            </span>
          </div>
          <span style={{ fontSize: 26, color: "#8ab4ff" }}>Roughly Right — daily estimation</span>
        </Shell>
      ),
      size,
    );
  }

  const p = payload.payload;
  const shown = Math.min(999, Math.max(0, p.total));

  return new ImageResponse(
    (
      <Shell>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <PixelArt sprite={TROPHY} palette={PALETTES.trophy} scale={4} />
            <span style={{ fontSize: 28, letterSpacing: 4, color: "#8ab4ff", fontWeight: 700 }}>
              ROUGHLY RIGHT
            </span>
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              padding: "10px 22px",
              borderRadius: 999,
              border: "1px solid rgba(148,170,255,0.4)",
              background: "rgba(148,170,255,0.12)",
              fontSize: 24,
              color: "#c7d0ea",
            }}
          >
            {p.mode === "daily" ? "Daily" : "Archive · unranked"} · #{p.displayNumber}
          </div>
        </div>

        {/* Score */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <div style={{ display: "flex", alignItems: "baseline" }}>
              <span style={{ fontSize: 168, fontWeight: 800, lineHeight: 1, letterSpacing: -4 }}>
                {shown}
              </span>
              <span style={{ fontSize: 52, color: "#8b97ba", marginLeft: 12 }}>/ {p.maxTotal}</span>
            </div>
            <span style={{ fontSize: 34, color: "#b48cff", fontWeight: 600 }}>{verdict(p.total)}</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", paddingRight: 20 }}>
            <PixelArt sprite={TROPHY} palette={PALETTES.trophy} scale={12} />
          </div>
        </div>

        {/* Marks */}
        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          <div style={{ display: "flex", gap: 14 }}>
            {p.marks.map((m) => {
              const s = MARK_STYLE[m.mark] ?? MARK_STYLE.Pass;
              return (
                <div
                  key={m.ordinal}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    padding: "12px 20px",
                    borderRadius: 14,
                    border: `2px solid ${s.border}`,
                    background: s.bg,
                    color: s.fg,
                    fontSize: 27,
                    fontWeight: 700,
                  }}
                >
                  <span>{MARK_ICONS[m.mark] ?? ""}</span>
                  <span>{m.mark}</span>
                </div>
              );
            })}
          </div>
          <span style={{ fontSize: 24, color: "#8b97ba" }}>
            {p.puzzleDate} · marks only — prompts, answers and guesses stay private
          </span>
        </div>
      </Shell>
    ),
    size,
  );
}
