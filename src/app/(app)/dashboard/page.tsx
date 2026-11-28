import type { Metadata } from "next";

import { PagePlaceholder } from "@/components/layout/page-placeholder";
import { ROLE_LABELS } from "@/lib/permissions";
import { guardRoute } from "@/lib/route-guard.server";

export const metadata: Metadata = { title: "Dashboard · Joy Palma Imports" };

export default async function DashboardPage() {
  const { user } = await guardRoute("/dashboard");
  const simplified = user.role === "SALES";

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted-foreground">
        Signed in as {user.name} · {ROLE_LABELS[user.role]}
      </p>
      <PagePlaceholder
        heading={simplified ? "Your day" : "Business at a glance"}
        description={
          simplified
            ? "Your sales today, low-stock items and quick buttons to record a sale or log a request."
            : "Revenue, sales, items sold and gross profit, top sellers, low stock, most requested items and the revenue trend."
        }
        plannedFor="Phase 8"
      />
    </div>
  );
}
