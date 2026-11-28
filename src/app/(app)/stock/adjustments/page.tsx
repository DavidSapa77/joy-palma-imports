import type { Metadata } from "next";

import { PagePlaceholder } from "@/components/layout/page-placeholder";
import { guardRoute } from "@/lib/route-guard.server";

export const metadata: Metadata = { title: "Adjustments · Joy Palma Imports" };

export default async function AdjustmentsPage() {
  await guardRoute("/stock/adjustments");
  return (
    <PagePlaceholder
      heading="Stock adjustments"
      description="Correct stock for damage, loss, theft or a recount, with a reason."
      plannedFor="Phase 5"
    />
  );
}
