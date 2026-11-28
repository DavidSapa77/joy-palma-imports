import type { Metadata } from "next";

import { PagePlaceholder } from "@/components/layout/page-placeholder";
import { guardRoute } from "@/lib/route-guard.server";

export const metadata: Metadata = { title: "Products · Joy Palma Imports" };

export default async function ProductsPage() {
  await guardRoute("/products");
  return (
    <PagePlaceholder
      heading="Product list"
      description="Search and filter products, see prices and stock levels, add and edit products."
      plannedFor="Phase 4"
    />
  );
}
