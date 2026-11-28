import { guardRoute } from "@/lib/route-guard.server";

/** Role guard for everything under /stock (lib/routes.ts); pages re-check their own path. */
export default async function StockLayout({ children }: { children: React.ReactNode }) {
  await guardRoute("/stock");
  return children;
}
