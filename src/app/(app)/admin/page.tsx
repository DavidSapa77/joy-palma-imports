import { redirect } from "next/navigation";

import { navForRole } from "@/lib/navigation";
import { guardRoute } from "@/lib/route-guard.server";

/** /admin → the first Admin page this role may open (a Manager lands on Audit Log). */
export default async function AdminPage(): Promise<never> {
  const session = await guardRoute("/admin");
  const admin = navForRole(session.user.role).find((item) => item.key === "admin");
  redirect(admin?.children?.[0]?.href ?? "/dashboard");
}
