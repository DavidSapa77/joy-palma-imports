import type { Metadata } from "next";

import { PagePlaceholder } from "@/components/layout/page-placeholder";
import { guardRoute } from "@/lib/route-guard.server";

export const metadata: Metadata = { title: "Users · Joy Palma Imports" };

export default async function UsersPage() {
  await guardRoute("/admin/users");
  return (
    <PagePlaceholder
      heading="Users"
      description="Add staff, assign roles, reset passwords and deactivate accounts."
      plannedFor="Phase 3"
    />
  );
}
