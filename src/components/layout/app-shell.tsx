"use client";

import { PanelLeftClose, PanelLeftOpen, Plus } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMemo, useState, type ReactNode } from "react";

import { Can, useRole } from "@/components/auth/can";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { ROLE_LABELS } from "@/lib/permissions";
import { bottomNavForRole, navForRole, pageTitle, SIDEBAR_COOKIE } from "@/lib/navigation";
import { cn } from "@/lib/utils";
import type { BusinessBrand as Brand } from "@/server/queries/settings";

import { BottomNav } from "./bottom-nav";
import { BusinessBrand } from "./business-brand";
import { GlobalSearch } from "./global-search";
import { NavList } from "./nav-list";
import { UserMenu, type ShellUser } from "./user-menu";

/**
 * App shell (UI spec §4.2): collapsible sidebar on desktop (≥1024px); top bar
 * everywhere; bottom nav + drawer below 1024px. Navigation is filtered by the
 * role from <PermissionsProvider>, using the same rules as the route guards.
 */
export function AppShell({
  user,
  brand,
  initialCollapsed,
  children,
}: {
  user: ShellUser;
  brand: Brand;
  initialCollapsed: boolean;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const role = useRole();
  const nav = useMemo(() => navForRole(role), [role]);
  const bottomNav = useMemo(() => bottomNavForRole(role), [role]);
  const [collapsed, setCollapsed] = useState(initialCollapsed);
  const [drawerOpen, setDrawerOpen] = useState(false);

  function toggleSidebar() {
    const next = !collapsed;
    setCollapsed(next);
    document.cookie = `${SIDEBAR_COOKIE}=${next ? "collapsed" : "expanded"}; path=/; max-age=31536000; samesite=lax`;
  }

  return (
    <div className="flex min-h-dvh bg-background">
      {/* Desktop sidebar */}
      <aside
        data-collapsed={collapsed}
        className={cn(
          "sticky top-0 hidden h-dvh shrink-0 flex-col border-r border-sidebar-border bg-sidebar transition-[width] duration-200 lg:flex",
          collapsed ? "w-[72px]" : "w-60",
        )}
      >
        <div className={cn("flex h-16 items-center border-b px-4", collapsed && "justify-center")}>
          <BusinessBrand brand={brand} showName={!collapsed} />
        </div>
        <nav aria-label="Main" className="flex-1 overflow-y-auto p-3">
          <NavList items={nav} pathname={pathname} collapsed={collapsed} />
        </nav>
        <div className={cn("border-t p-3", collapsed && "flex justify-center")}>
          <Button
            variant="ghost"
            onClick={toggleSidebar}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            className={cn(
              "w-full justify-start gap-3 text-muted-foreground",
              collapsed && "w-auto",
            )}
          >
            {collapsed ? (
              <PanelLeftOpen className="size-5" aria-hidden="true" />
            ) : (
              <>
                <PanelLeftClose className="size-5" aria-hidden="true" />
                Collapse
              </>
            )}
          </Button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b bg-background/95 px-4 backdrop-blur lg:h-16 lg:gap-3 lg:px-6">
          <h1 className="min-w-0 flex-1 truncate text-lg font-semibold text-foreground lg:text-2xl">
            {pageTitle(pathname)}
          </h1>
          <GlobalSearch />
          <Can perm="sale.create">
            <Button asChild className="hidden lg:inline-flex lg:h-9">
              <Link href="/sales/new">
                <Plus aria-hidden="true" />
                New Sale
              </Link>
            </Button>
          </Can>
          <UserMenu user={user} />
        </header>

        <main className="mx-auto w-full max-w-[1280px] flex-1 p-4 pb-28 sm:p-6 sm:pb-28 lg:pb-6">
          {children}
        </main>
      </div>

      {/* Mobile */}
      <BottomNav
        items={bottomNav}
        pathname={pathname}
        menuOpen={drawerOpen}
        onOpenMenu={() => setDrawerOpen(true)}
      />
      <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
        <SheetContent side="left" className="w-72 gap-0 p-0 lg:hidden">
          <div className="flex h-16 items-center border-b px-4 pr-14">
            <SheetTitle asChild>
              <div>
                <BusinessBrand brand={brand} />
              </div>
            </SheetTitle>
            <SheetDescription className="sr-only">All sections</SheetDescription>
          </div>
          <nav aria-label="Menu" className="flex-1 overflow-y-auto p-3">
            <NavList items={nav} pathname={pathname} onNavigate={() => setDrawerOpen(false)} />
          </nav>
          <div className="border-t p-4 text-sm">
            <p className="truncate font-medium">{user.name}</p>
            <p className="text-xs text-muted-foreground">{ROLE_LABELS[user.role]}</p>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
