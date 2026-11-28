import type { Metadata } from "next";

import { PagePlaceholder } from "@/components/layout/page-placeholder";
import { guardRoute } from "@/lib/route-guard.server";

export const metadata: Metadata = { title: "Sales · Joy Palma Imports" };

export default async function SalesPage() {
  await guardRoute("/sales");
  return (
    <PagePlaceholder
      heading="Sales history"
      description="Receipts with filters, totals, sale details and voiding."
      plannedFor="Phase 6"
    />
  );
}
