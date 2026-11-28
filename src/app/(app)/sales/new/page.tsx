import type { Metadata } from "next";

import { PagePlaceholder } from "@/components/layout/page-placeholder";
import { guardRoute } from "@/lib/route-guard.server";

export const metadata: Metadata = { title: "New Sale · Joy Palma Imports" };

export default async function NewSalePage() {
  await guardRoute("/sales/new");
  return (
    <PagePlaceholder
      heading="Record a sale"
      description="Search products, set quantities and complete the sale — prices come from the product record."
      plannedFor="Phase 6"
    />
  );
}
