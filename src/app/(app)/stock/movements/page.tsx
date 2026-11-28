import type { Metadata } from "next";

import { PagePlaceholder } from "@/components/layout/page-placeholder";
import { guardRoute } from "@/lib/route-guard.server";

export const metadata: Metadata = { title: "Movements · Joy Palma Imports" };

export default async function MovementsPage() {
  await guardRoute("/stock/movements");
  return (
    <PagePlaceholder
      heading="Movement history"
      description="Every stock change with a running balance, filterable by product, type and date."
      plannedFor="Phase 5"
    />
  );
}
