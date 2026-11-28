"use client";

import Link from "next/link";

import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { activeLink, flattenNav, type NavItem, type NavLink } from "@/lib/navigation";
import { cn } from "@/lib/utils";

/**
 * The role-filtered nav tree, shared by the desktop sidebar and the mobile
 * drawer. Sections (Stock, Admin) show a small heading and their links.
 * `collapsed` shows icons only, with the label in a tooltip.
 */
export function NavList({
  items,
  pathname,
  collapsed = false,
  onNavigate,
}: {
  items: readonly NavItem[];
  pathname: string;
  collapsed?: boolean;
  onNavigate?: () => void;
}) {
  const active = activeLink(flattenNav(items), pathname);
  const link = (l: NavLink) => (
    <li key={l.key}>
      <NavEntry
        link={l}
        active={active?.key === l.key}
        collapsed={collapsed}
        onNavigate={onNavigate}
      />
    </li>
  );

  return (
    <ul className="flex flex-col gap-0.5">
      {items.map((item) =>
        item.children ? (
          <li key={item.key} className="flex flex-col gap-0.5">
            {collapsed ? (
              <div role="separator" className="mx-3 my-2 border-t border-sidebar-border" />
            ) : (
              <p className="px-3 pt-4 pb-1 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                {item.label}
              </p>
            )}
            <ul className="flex flex-col gap-0.5" aria-label={item.label}>
              {item.children.map(link)}
            </ul>
          </li>
        ) : (
          link(item)
        ),
      )}
    </ul>
  );
}

function NavEntry({
  link,
  active,
  collapsed,
  onNavigate,
}: {
  link: NavLink;
  active: boolean;
  collapsed: boolean;
  onNavigate?: () => void;
}) {
  const Icon = link.icon;
  const anchor = (
    <Link
      href={link.href}
      onClick={onNavigate}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex min-h-11 items-center gap-3 rounded-md px-3 text-sm font-medium text-sidebar-foreground/80 transition-colors outline-none hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:ring-3 focus-visible:ring-ring/50 lg:min-h-10",
        active && "bg-primary/10 text-primary hover:bg-primary/15 hover:text-primary",
        collapsed && "justify-center px-0",
      )}
    >
      <Icon className="size-5 shrink-0" aria-hidden="true" />
      <span className={cn("truncate", collapsed && "sr-only")}>{link.label}</span>
    </Link>
  );
  if (!collapsed) return anchor;
  return (
    <Tooltip>
      <TooltipTrigger asChild>{anchor}</TooltipTrigger>
      <TooltipContent side="right">{link.label}</TooltipContent>
    </Tooltip>
  );
}
