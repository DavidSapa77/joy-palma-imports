import type { Role } from "@prisma/client";
import {
  ChartColumn,
  History,
  House,
  LayoutDashboard,
  MessageSquareText,
  Package,
  PackagePlus,
  Receipt,
  ScrollText,
  Settings,
  Shield,
  ShoppingCart,
  SlidersHorizontal,
  Tags,
  Users,
  Warehouse,
  type LucideIcon,
} from "lucide-react";

import { can } from "@/lib/permissions";
import { canAccessPath, matchesPrefix } from "@/lib/routes";

/**
 * App navigation (UI spec §3 and §3.1). Visibility comes from lib/routes.ts —
 * an item is shown exactly when its page would let the user in.
 */
/**
 * Cookie that remembers the desktop sidebar state ("collapsed" | "expanded"),
 * read by the server layout so the page renders in the right state (no flash).
 */
export const SIDEBAR_COOKIE = "jpi-sidebar";

export type NavLink = { key: string; label: string; href: string; icon: LucideIcon };
export type NavItem = NavLink & { children?: readonly NavLink[] };

export const NAV_ITEMS: readonly NavItem[] = [
  { key: "dashboard", label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { key: "new-sale", label: "New Sale", href: "/sales/new", icon: ShoppingCart },
  { key: "sales", label: "Sales", href: "/sales", icon: Receipt },
  { key: "products", label: "Products", href: "/products", icon: Package },
  {
    key: "stock",
    label: "Stock",
    href: "/stock",
    icon: Warehouse,
    children: [
      { key: "stock-in", label: "Stock-In", href: "/stock/in", icon: PackagePlus },
      {
        key: "adjustments",
        label: "Adjustments",
        href: "/stock/adjustments",
        icon: SlidersHorizontal,
      },
      { key: "movements", label: "Movements", href: "/stock/movements", icon: History },
    ],
  },
  { key: "requests", label: "Requests", href: "/requests", icon: MessageSquareText },
  { key: "reports", label: "Reports", href: "/reports", icon: ChartColumn },
  {
    key: "admin",
    label: "Admin",
    href: "/admin",
    icon: Shield,
    children: [
      { key: "users", label: "Users", href: "/admin/users", icon: Users },
      { key: "categories", label: "Categories", href: "/admin/categories", icon: Tags },
      { key: "settings", label: "Settings", href: "/admin/settings", icon: Settings },
      { key: "audit", label: "Audit Log", href: "/admin/audit", icon: ScrollText },
    ],
  },
];

/**
 * The navigation a role may see. Sections keep only their allowed children
 * and disappear when none are left (a Manager's Admin holds just Audit Log).
 */
export function navForRole(role: Role | null | undefined): NavItem[] {
  const out: NavItem[] = [];
  for (const item of NAV_ITEMS) {
    if (item.children) {
      const children = item.children.filter((c) => canAccessPath(role, c.href));
      if (children.length > 0) out.push({ ...item, children });
    } else if (canAccessPath(role, item.href)) {
      out.push(item);
    }
  }
  return out;
}

/** Every clickable link in a nav tree, in order (sections contribute their children). */
export function flattenNav(items: readonly NavItem[]): NavLink[] {
  return items.flatMap((item) => (item.children ? [...item.children] : [item]));
}

/** The link that best matches the current path (longest href), for the active state. */
export function activeLink(links: readonly NavLink[], pathname: string): NavLink | undefined {
  let best: NavLink | undefined;
  for (const link of links) {
    if (matchesPrefix(pathname, link.href) && (!best || link.href.length > best.href.length)) {
      best = link;
    }
  }
  return best;
}

/** Top-bar title for a path: the label of the most specific nav link. */
export function pageTitle(pathname: string): string {
  return activeLink(flattenNav(NAV_ITEMS), pathname)?.label ?? "Joy Palma Imports";
}

export type BottomNavItem = NavLink & { raised?: boolean };

const HOME: NavLink = { key: "dashboard", label: "Home", href: "/dashboard", icon: House };

/**
 * Mobile bottom nav (UI spec §3.1): Home · Products · [+ Sale] · Reports|Requests,
 * followed by a Menu button (rendered by the component) that opens the drawer.
 *
 * - Owner / Manager: Home · Products · + Sale · Reports
 * - Sales Staff:     Home · Products · + Sale · Requests
 * - Viewer (can't sell): Home · Products · Sales · Reports
 *
 * "+ Sale" is the raised centre button, so it sits in the middle slot.
 */
export function bottomNavForRole(role: Role | null | undefined): BottomNavItem[] {
  const links = new Map(flattenNav(navForRole(role)).map((l) => [l.key, l]));
  const items: BottomNavItem[] = [HOME];

  const products = links.get("products");
  if (products) items.push(products);

  if (can(role, "sale.create")) {
    items.push({ ...links.get("new-sale")!, label: "Sale", raised: true });
  } else {
    const sales = links.get("sales");
    if (sales) items.push(sales);
  }

  const fourth = links.get("reports") ?? links.get("requests");
  if (fourth) items.push(fourth);
  return items;
}
