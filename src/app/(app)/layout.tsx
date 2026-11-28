import { cookies } from "next/headers";

import { PermissionsProvider } from "@/components/auth/can";
import { AppShell } from "@/components/layout/app-shell";
import { SIDEBAR_COOKIE } from "@/lib/navigation";
import { requireSession } from "@/lib/session";
import { getBusinessBrand } from "@/server/queries/settings";

/** Signed-in area: app shell (UI spec §4.2) around every page. */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await requireSession();
  const [brand, cookieStore] = await Promise.all([getBusinessBrand(), cookies()]);
  const { name, email, role } = session.user;

  return (
    <PermissionsProvider role={role}>
      <AppShell
        user={{ name, email, role }}
        brand={brand}
        initialCollapsed={cookieStore.get(SIDEBAR_COOKIE)?.value === "collapsed"}
      >
        {children}
      </AppShell>
    </PermissionsProvider>
  );
}
