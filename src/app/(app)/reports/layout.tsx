import { guardRoute } from "@/lib/route-guard.server";

/** Role guard for everything under /reports (lib/routes.ts); pages re-check their own path. */
export default async function ReportsLayout({ children }: { children: React.ReactNode }) {
  await guardRoute("/reports");
  return children;
}
