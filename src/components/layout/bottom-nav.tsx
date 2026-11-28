"use client";

import { Menu } from "lucide-react";
import Link from "next/link";

import { activeLink, type BottomNavItem } from "@/lib/navigation";
import { cn } from "@/lib/utils";

const itemClass =
  "flex min-h-14 w-full flex-col items-center justify-center gap-0.5 px-1 text-[11px] font-medium text-muted-foreground outline-none focus-visible:ring-3 focus-visible:ring-ring/50";

/**
 * Mobile bottom nav (below lg): role-specific items from bottomNavForRole(),
 * "+ Sale" as a raised centre button, and Menu, which opens the drawer.
 */
export function BottomNav({
  items,
  pathname,
  onOpenMenu,
  menuOpen,
}: {
  items: readonly BottomNavItem[];
  pathname: string;
  onOpenMenu: () => void;
  menuOpen: boolean;
}) {
  const active = activeLink(items, pathname);

  return (
    <nav
      aria-label="Bottom navigation"
      className="fixed inset-x-0 bottom-0 z-40 border-t bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden"
    >
      <ul
        className="mx-auto grid max-w-lg"
        style={{ gridTemplateColumns: `repeat(${items.length + 1}, minmax(0, 1fr))` }}
      >
        {items.map((item) => {
          const Icon = item.icon;
          const isActive = active?.key === item.key;
          return (
            <li key={item.key} className="flex">
              {item.raised ? (
                <Link
                  href={item.href}
                  aria-label="New Sale"
                  aria-current={isActive ? "page" : undefined}
                  className={cn(itemClass, "text-primary")}
                >
                  <span className="-mt-6 flex size-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg ring-4 ring-background">
                    <Icon className="size-6" aria-hidden="true" />
                  </span>
                  <span aria-hidden="true">+ {item.label}</span>
                </Link>
              ) : (
                <Link
                  href={item.href}
                  aria-current={isActive ? "page" : undefined}
                  className={cn(itemClass, isActive && "text-primary")}
                >
                  <Icon className="size-5" aria-hidden="true" />
                  {item.label}
                </Link>
              )}
            </li>
          );
        })}
        <li className="flex">
          <button
            type="button"
            onClick={onOpenMenu}
            aria-expanded={menuOpen}
            aria-haspopup="dialog"
            className={cn(itemClass, menuOpen && "text-primary")}
          >
            <Menu className="size-5" aria-hidden="true" />
            Menu
          </button>
        </li>
      </ul>
    </nav>
  );
}
