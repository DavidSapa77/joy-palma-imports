import { guardRoute } from "@/lib/route-guard.server";

/** Role guard for everything under /admin (lib/routes.ts); pages re-check their own path. */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await guardRoute("/admin");
  return children;
}
