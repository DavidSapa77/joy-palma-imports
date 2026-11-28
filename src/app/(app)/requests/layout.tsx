import { guardRoute } from "@/lib/route-guard.server";

/** Role guard for everything under /requests (lib/routes.ts); pages re-check their own path. */
export default async function RequestsLayout({ children }: { children: React.ReactNode }) {
  await guardRoute("/requests");
  return children;
}
