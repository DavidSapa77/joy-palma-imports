import { guardRoute } from "@/lib/route-guard.server";

/** Role guard for everything under /sales (lib/routes.ts); pages re-check their own path. */
export default async function SalesLayout({ children }: { children: React.ReactNode }) {
  await guardRoute("/sales");
  return children;
}
