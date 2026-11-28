import type { Metadata } from "next";

import { PagePlaceholder } from "@/components/layout/page-placeholder";
import { guardRoute } from "@/lib/route-guard.server";

export const metadata: Metadata = { title: "Audit Log · Joy Palma Imports" };

export default async function AuditPage() {
  await guardRoute("/admin/audit");
  return (
    <PagePlaceholder
      heading="Audit log"
      description="Who changed what and when — prices, stock, sales and users."
      plannedFor="Phase 9"
    />
  );
}
