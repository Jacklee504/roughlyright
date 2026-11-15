"use client";

import { useEffect, useState } from "react";

const STORAGE_KEY = "rr_theme";

/**
 * Light/dark switch — a premium perk. The initial theme is applied by a tiny
 * inline script in the layout (no flash); this control only flips it.
 */
export default function ThemeToggle() {
  const [light, setLight] = useState(false);

  useEffect(() => {
    setLight(document.documentElement.dataset.theme === "light");
  }, []);

  function toggle() {
    const next = !light;
    setLight(next);
    if (next) document.documentElement.dataset.theme = "light";
    else delete document.documentElement.dataset.theme;
    try {
      if (next) localStorage.setItem(STORAGE_KEY, "light");
      else localStorage.removeItem(STORAGE_KEY);
    } catch {
      // storage unavailable — theme still applies for this visit
    }
  }

  return (
    <button
      type="button"
      className="theme-toggle"
      onClick={toggle}
      aria-pressed={light}
      title={light ? "Switch to dark" : "Switch to light"}
    >
      {light ? "🌙" : "☀️"}
    </button>
  );
}
