import type { Metadata } from "next";

import { PagePlaceholder } from "@/components/layout/page-placeholder";
import { guardRoute } from "@/lib/route-guard.server";

export const metadata: Metadata = { title: "Stock-In · Joy Palma Imports" };

export default async function StockInPage() {
  await guardRoute("/stock/in");
  return (
    <PagePlaceholder
      heading="Receive stock"
      description="Record a shipment: products, quantities and unit costs, plus the stock-in history."
      plannedFor="Phase 5"
    />
  );
}
