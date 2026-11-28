import type { Metadata } from "next";

import { PagePlaceholder } from "@/components/layout/page-placeholder";
import { guardRoute } from "@/lib/route-guard.server";

export const metadata: Metadata = { title: "Reports · Joy Palma Imports" };

const REPORTS = [
  "Best Sellers",
  "Slow Movers",
  "Monthly Summary",
  "Seasonality",
  "Categories",
  "Most Requested",
  "Restock Suggestions",
  "Staff Activity",
];

export default async function ReportsPage() {
  await guardRoute("/reports");
  return (
    <PagePlaceholder
      heading="Reports"
      description="Answers to “what sells?” for any period, with charts, CSV export and print."
      plannedFor="Phase 8"
    >
      <ul className="grid w-full gap-2 text-sm sm:grid-cols-2">
        {REPORTS.map((r) => (
          <li key={r} className="rounded-md border bg-background px-3 py-2 text-muted-foreground">
            {r}
          </li>
        ))}
      </ul>
    </PagePlaceholder>
  );
}
