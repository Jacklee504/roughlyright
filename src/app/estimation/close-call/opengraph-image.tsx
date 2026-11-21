import { ImageResponse } from "next/og";

export const alt = "Close Call by Roughly Right. Outsmart the House in a five-round estimation game.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const rounds = ["01", "02", "03", "04", "05"];

export default function Image() {
  return new ImageResponse(
    <div style={{ position: "relative", display: "flex", flexDirection: "column", width: "100%", height: "100%", background: "#fff3d6", color: "#17152d", padding: "60px 70px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "3px solid #17152d", paddingBottom: 22 }}>
        <div style={{ fontFamily: "monospace", fontSize: 29, fontWeight: 700, letterSpacing: 5 }}>ROUGHLY RIGHT</div>
        <div style={{ display: "flex", alignItems: "center", gap: 13, fontFamily: "monospace", fontSize: 23, fontWeight: 700 }}>
          <div style={{ display: "flex", width: 14, height: 14, borderRadius: 7, background: "#df3d31" }} />
          ON AIR
        </div>
      </div>
      <div style={{ display: "flex", flexGrow: 1, alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ fontSize: 126, fontWeight: 800, letterSpacing: -9, lineHeight: 1 }}>Close Call</div>
          <div style={{ fontSize: 39, marginTop: 23 }}>How close can you get?</div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", paddingRight: 8, gap: 11 }}>
          <div style={{ display: "flex", width: 248, padding: "12px 25px", border: "3px solid #17152d", background: "#2116a4", color: "#fff3d6", fontWeight: 800, fontSize: 41 }}>YOU</div>
          <div style={{ display: "flex", width: 248, padding: "12px 25px", border: "3px solid #17152d", background: "#ff744f", fontWeight: 800, fontSize: 41 }}>HOUSE</div>
        </div>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 12, borderTop: "3px solid #17152d", paddingTop: 24 }}>
        {rounds.map((round, index) => (
          <div key={round} style={{ display: "flex", justifyContent: "center", alignItems: "center", width: 60, height: 53, border: "2px solid #17152d", background: index === 4 ? "#d9f45b" : "transparent", fontFamily: "monospace", fontSize: 25, fontWeight: 700 }}>{round}</div>
        ))}
        <div style={{ fontSize: 27, fontWeight: 700, marginLeft: 13 }}>Five rounds. One final wager.</div>
      </div>
    </div>,
    size,
  );
}
