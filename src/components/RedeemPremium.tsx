"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/** Redeem form for owner-issued premium codes (PREMIUM_CODES env). */
export default function RedeemPremium() {
  const [code, setCode] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [ok, setOk] = useState(false);
  const [busy, setBusy] = useState(false);
  const router = useRouter();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch("/api/estimation/premium/redeem", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ code }),
      });
      const data = (await res.json()) as { ok: boolean; message?: string };
      if (data.ok) {
        setOk(true);
        setMessage("Premium is active — enjoy! Reloading…");
        setTimeout(() => router.refresh(), 1200);
      } else {
        setMessage(data.message ?? "That code isn't valid.");
      }
    } catch {
      setMessage("Something went wrong — try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="redeem-form">
      <label htmlFor="premium-code">Have an upgrade code?</label>
      <div className="input-row">
        <input
          id="premium-code"
          type="text"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="e.g. FERMI-2026"
          autoComplete="off"
          autoCapitalize="characters"
        />
        <button type="submit" className="primary" disabled={busy || code.trim().length === 0}>
          {busy ? "Checking…" : "Redeem"}
        </button>
      </div>
      {message ? (
        <p role={ok ? "status" : "alert"} className={ok ? "preview" : "preview invalid"}>
          {ok ? "✓ " : "⚠ "}
          {message}
        </p>
      ) : null}
    </form>
  );
}
