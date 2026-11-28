import { guardRoute } from "@/lib/route-guard.server";

/** Role guard for everything under /products (lib/routes.ts); pages re-check their own path. */
export default async function ProductsLayout({ children }: { children: React.ReactNode }) {
  await guardRoute("/products");
  return children;
}
