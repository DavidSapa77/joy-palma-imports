import { redirect } from "next/navigation";

import { guardRoute } from "@/lib/route-guard.server";

export default async function StockPage(): Promise<never> {
  await guardRoute("/stock");
  redirect("/stock/in");
}
