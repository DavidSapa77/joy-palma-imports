import type { Metadata } from "next";

import { PagePlaceholder } from "@/components/layout/page-placeholder";
import { guardRoute } from "@/lib/route-guard.server";

export const metadata: Metadata = { title: "Categories · Joy Palma Imports" };

export default async function CategoriesPage() {
  await guardRoute("/admin/categories");
  return (
    <PagePlaceholder
      heading="Categories"
      description="Create, rename and archive product categories."
      plannedFor="Phase 3"
    />
  );
}
