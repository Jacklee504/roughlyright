"use client";

import { useState } from "react";

/**
 * Privacy self-service controls (Q25). Export downloads immediately; deletion
 * demands a deliberately typed confirmation and clears the session cookie.
 */
export default function PrivacyControls({ hasData }: { hasData: boolean }) {
  const [confirmText, setConfirmText] = useState("");
  const [status, setStatus] = useState<{ kind: "ok" | "error"; message: string } | null>(null);
  const [busy, setBusy] = useState(false);

  if (!hasData) {
    return (
      <div className="card">
        <h2>No data yet</h2>
        <p className="muted">
          This browser has no guest record, so there is nothing to export or delete. Play a daily and the
          controls on this page become active.
        </p>
      </div>
    );
  }

  const doDelete = async () => {
    setBusy(true);
    setStatus(null);
    try {
      const res = await fetch("/api/privacy/delete", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ confirm: confirmText.trim() }),
      });
      const json = await res.json();
      if (res.ok && json.ok) {
        setStatus({
          kind: "ok",
          message: json.attempts > 0
            ? `Deleted ${json.attempts} attempt${json.attempts === 1 ? "" : "s"} with all rounds, scores and share links. This browser now starts fresh.`
            : "Deleted your guest record. This browser now starts fresh.",
        });
        setConfirmText("");
      } else {
        setStatus({ kind: "error", message: json.message ?? "Something went wrong — nothing was deleted." });
      }
    } catch {
      setStatus({ kind: "error", message: "Network error — nothing was deleted." });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="card">
      <h2>Export your data</h2>
      <p className="muted">
        Downloads a JSON file with your attempts, every guess you locked in, your scores and your share links.
      </p>
      <div className="actions" style={{ marginTop: 10 }}>
        <a className="btn" href="/api/privacy/export" download>
          Download my data (JSON)
        </a>
      </div>

      <h2 style={{ marginTop: 22 }}>Delete your data</h2>
      <p className="muted">
        Permanently removes your attempts, rounds, scores and share links, then resets this browser to a fresh
        guest. This cannot be undone.
      </p>
      <label className="muted small" htmlFor="privacy-confirm" style={{ display: "block", margin: "10px 0 6px" }}>
        Type <strong>DELETE MY DATA</strong> to confirm
      </label>
      <input
        id="privacy-confirm"
        type="text"
        value={confirmText}
        onChange={(e) => setConfirmText(e.target.value)}
        autoComplete="off"
        spellCheck={false}
        style={{ width: "100%", maxWidth: 320 }}
      />
      <div className="actions" style={{ marginTop: 12 }}>
        <button
          className="btn danger"
          type="button"
          disabled={busy || confirmText.trim() !== "DELETE MY DATA"}
          onClick={doDelete}
        >
          {busy ? "Deleting…" : "Delete everything"}
        </button>
      </div>
      {status ? (
        <p role={status.kind === "error" ? "alert" : "status"} className="muted" style={{ marginTop: 10 }}>
          {status.message}
        </p>
      ) : null}
    </div>
  );
}
