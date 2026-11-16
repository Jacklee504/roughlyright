/** @type {import('next').NextConfig} */
const nextConfig = {
  // A production build can run while `next dev` is serving (local verification);
  // a separate dist directory keeps the two from clobbering each other's
  // .next output. Normal builds (and Netlify) use the default .next.
  distDir: process.env.NEXT_DIST_DIR || ".next",
  // Native/WASM drivers must stay outside the bundler.
  serverExternalPackages: ["@electric-sql/pglite", "pg"],
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        ],
      },
      // Q52: personalised / game-state pages must never be cached by a CDN or
      // browser — a stale cache could serve the wrong day's puzzle state or
      // one guest's result to another.
      {
        source: "/estimation/result/:token*",
        headers: [{ key: "Cache-Control", value: "no-store" }],
      },
      {
        source: "/estimation/archive/:date*",
        headers: [{ key: "Cache-Control", value: "no-store" }],
      },
      {
        source: "/estimation/insights",
        headers: [{ key: "Cache-Control", value: "no-store" }],
      },
    ];
  },
};

export default nextConfig;
