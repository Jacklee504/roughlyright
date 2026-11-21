"use client";

import { useEffect, useState } from "react";
import { SHOW_RECORD_KEY } from "@/lib/domain/close-call";
import { LAB_PROGRESS_KEY } from "@/lib/domain/estimation-lab";
import { SCALE_PROGRESS_KEY } from "@/lib/domain/scale-run";

const PROGRESS_KEYS = [SHOW_RECORD_KEY, SCALE_PROGRESS_KEY, LAB_PROGRESS_KEY];

/**
 * Privacy self-service controls (Q25). Export downloads immediately; deletion
 * demands a deliberately typed confirmation and clears the session cookie.
 */
export default function PrivacyControls({ hasData }: { hasData: boolean }) {
  const [localRecord, setLocalRecord] = useState(false);
  const [guestDeleted, setGuestDeleted] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [status, setStatus] = useState<{ kind: "ok" | "error"; message: string } | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    try {
      setLocalRecord(PROGRESS_KEYS.some((key) => window.localStorage.getItem(key) !== null));
    } catch {
      // Storage may be unavailable in private browsing.
    }
  }, []);

  const hasGuestRecord = hasData && !guestDeleted;
  if (!hasGuestRecord && !localRecord) {
    return (
      <div className="card">
        <h2>{status?.kind === "ok" ? "Data cleared" : "No data yet"}</h2>
        {status ? <p role={status.kind === "error" ? "alert" : "status"}>{status.message}</p> : <p className="muted">Privacy controls appear here when this browser has a guest record or saved game progress.</p>}
      </div>
    );
  }

  function clearLocalProgress() {
    try {
      for (const key of PROGRESS_KEYS) window.localStorage.removeItem(key);
      setLocalRecord(false);
      return true;
    } catch {
      return false;
    }
  }

  const doDelete = async () => {
    if (confirmText.trim() !== "DELETE MY DATA") return;
    if (!hasGuestRecord) {
      const cleared = clearLocalProgress();
      setStatus(cleared
        ? { kind: "ok", message: "Progress cleared from this browser." }
        : { kind: "error", message: "Could not clear progress in this browser." });
      if (cleared) setConfirmText("");
      return;
    }
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
        const localCleared = clearLocalProgress();
        setGuestDeleted(true);
        setStatus({
          kind: localCleared ? "ok" : "error",
          message: !localCleared
            ? "Your guest record was deleted. Progress in this browser could not be cleared."
            : json.attempts > 0
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
      {hasGuestRecord ? (
        <>
          <h2>Export your data</h2>
          <p className="muted">
            Downloads a JSON file with your daily and archive attempts, locked guesses, scores and share links.
          </p>
          <div className="actions" style={{ marginTop: 10 }}>
            <a className="btn" href="/api/privacy/export" download>
              Download my data (JSON)
            </a>
          </div>
        </>
      ) : null}

      <h2 style={hasGuestRecord ? { marginTop: 22 } : undefined}>{hasGuestRecord ? "Delete your data" : "Clear browser progress"}</h2>
      <p className="muted">
        {hasGuestRecord
          ? "Permanently removes your attempts, rounds, scores, daily result links and browser progress, then resets your guest record."
          : "Permanently removes your Close Call record, Scale Run progress and Lab best scores from this browser."}
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
          {busy ? "Deleting…" : hasGuestRecord ? "Delete everything" : "Clear browser progress"}
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
