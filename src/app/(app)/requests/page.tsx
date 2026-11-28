import type { Metadata } from "next";

import { PagePlaceholder } from "@/components/layout/page-placeholder";
import { guardRoute } from "@/lib/route-guard.server";

export const metadata: Metadata = { title: "Requests · Joy Palma Imports" };

export default async function RequestsPage() {
  await guardRoute("/requests");
  return (
    <PagePlaceholder
      heading="Customer requests"
      description="Log what customers asked for that the shop didn't have, and see what is asked for most."
      plannedFor="Phase 7"
    />
  );
}
