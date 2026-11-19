/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // The build output directory. Defaults to .next for `next start` and ordinary builds. The Mac
  // mini updater builds the new version into a staging dir (CC_DIST_DIR=.next-staging) so it never
  // replaces the .next being served, then switches and restarts (CC11 spec §1, updater).
  distDir: process.env.CC_DIST_DIR || ".next",
  // better-sqlite3 is a native module; keep it external to the server bundle.
  experimental: {
    serverComponentsExternalPackages: ["better-sqlite3"],
  },
};

export default nextConfig;
