import type { Metadata } from "next";

import { PagePlaceholder } from "@/components/layout/page-placeholder";
import { guardRoute } from "@/lib/route-guard.server";

export const metadata: Metadata = { title: "Settings · Joy Palma Imports" };

export default async function SettingsPage() {
  await guardRoute("/admin/settings");
  return (
    <PagePlaceholder
      heading="Business settings"
      description="Business profile, currency, time zone, low-stock default and receipt footer."
      plannedFor="Phase 3"
    />
  );
}
