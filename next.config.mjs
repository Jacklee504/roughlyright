/** @type {import('next').NextConfig} */
const nextConfig = {
  // PGlite ships WASM assets and must stay outside the bundler.
  serverExternalPackages: ["@electric-sql/pglite"],
};

export default nextConfig;
