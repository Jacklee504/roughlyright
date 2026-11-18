"use client";

/** Last-resort boundary: layout itself crashed, so plain inline styles only. */
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, background: "#060a17", color: "#f1f4ff", fontFamily: "system-ui, sans-serif", minHeight: "100vh", display: "grid", placeItems: "center", textAlign: "center", padding: "24px" }}>
        <div>
          <p style={{ fontSize: "1.6rem", fontWeight: 800, margin: "0 0 8px" }}>Roughly Right hit turbulence</p>
          <p style={{ color: "#9aa7c7", margin: "0 0 20px" }}>
            The observatory lost power for a moment. Progress and streaks are stored server-side and are safe.
          </p>
          <button
            onClick={reset}
            style={{ padding: "10px 22px", borderRadius: 12, border: "1px solid #5fe3c3", background: "transparent", color: "#5fe3c3", fontWeight: 700, cursor: "pointer" }}
          >
            Try again
          </button>
          {error.digest ? <p style={{ color: "#5a6584", fontSize: "0.8rem", marginTop: 16 }}>Reference: {error.digest}</p> : null}
        </div>
      </body>
    </html>
  );
}
