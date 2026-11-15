/** Coarse same-origin protection for write routes (framework SameSite + explicit check). */
export function sameOrigin(req: Request): boolean {
  const site = req.headers.get("sec-fetch-site");
  if (site === "same-origin" || site === "none") return true;
  const origin = req.headers.get("origin");
  if (!origin) return true; // no Origin header (non-browser) — cookie rules still apply
  try {
    const o = new URL(origin);
    const host = req.headers.get("host");
    return !!host && o.host === host;
  } catch {
    return false;
  }
}
