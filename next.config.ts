import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // E2E tests build into their own folder so they never clash with `pnpm dev`.
  distDir: process.env.NEXT_DIST_DIR || ".next",
};

export default nextConfig;
