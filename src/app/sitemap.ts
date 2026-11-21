import type { MetadataRoute } from "next";

/** Public, crawlable pages only. Results and API routes are excluded. */
export default function sitemap(): MetadataRoute.Sitemap {
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  const routes = ["", "/estimation/close-call", "/estimation", "/estimation/archive", "/estimation/warm-up", "/estimation/scale-run", "/estimation/lab", "/estimation/insights", "/terms", "/privacy"];
  return routes.map((r) => ({
    url: `${base}${r}`,
    lastModified: new Date(),
    changeFrequency: "daily",
    priority: r === "" || r === "/estimation" ? 1 : 0.6,
  }));
}
