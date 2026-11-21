import { ImageResponse } from "next/og";
import { SIGNAL_METER, SIGNAL_PALETTE } from "@/components/pixel/art";

export const alt = "Scale Run by Roughly Right. Seven estimates on a ruler that jumps tenfold at every step.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function Image() {
  return new ImageResponse(
    <div style={{ display: "flex", width: "100%", height: "100%", background: "#0c201c", color: "#ecf3e8", padding: "72px 78px" }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
        <div style={{ fontFamily: "monospace", fontSize: 29, letterSpacing: 6, color: "#9de8b9" }}>ROUGHLY RIGHT</div>
        <div style={{ fontSize: 111, letterSpacing: -4, fontWeight: 800 }}>Scale Run</div>
        <div style={{ fontSize: 39, color: "#b7d5c2" }}>How big is big?</div>
      </div>
      <div style={{ position: "absolute", top: 46, right: 69, display: "flex", flexDirection: "column" }}>
        {SIGNAL_METER.map((row, y) => (
          <div key={y} style={{ display: "flex" }}>
            {[...row].map((cell, x) => (
              <div key={x} style={{ width: 23, height: 23, backgroundColor: SIGNAL_PALETTE[cell] ?? "transparent" }} />
            ))}
          </div>
        ))}
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", position: "absolute", left: 78, right: 78, bottom: 59, borderTop: "3px solid #6bb590" }}>
        {["0.01", "0.1", "1", "10", "100"].map((label) => (
          <div key={label} style={{ display: "flex", flexDirection: "column", alignItems: "center", width: 92, fontFamily: "monospace", fontSize: 29, color: "#b7d5c2" }}>
            <div style={{ display: "flex", width: 3, height: 24, backgroundColor: "#6bb590", marginBottom: 8 }} />
            {label}
          </div>
        ))}
      </div>
    </div>,
    size,
  );
}
