import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // E2E tests build into their own folder so they never clash with `pnpm dev`.
  distDir: process.env.NEXT_DIST_DIR || ".next",
  // Enables forbidden() + forbidden.tsx for the friendly 403 page (lib/route-guard.server.ts).
  experimental: { authInterrupts: true },
};

export default nextConfig;
