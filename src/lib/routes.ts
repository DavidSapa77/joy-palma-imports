import type { Role } from "@prisma/client";

import { can, type Permission } from "@/lib/permissions";

/**
 * Which roles may open which pages (UI spec §3.1), expressed with the
 * permissions from lib/permissions.ts. Pure and edge-safe: used by
 * middleware.ts, by the page guards (lib/route-guard.server.ts) and to filter
 * the navigation, so menus and route protection can never disagree.
 *
 * A rule matches its prefix and everything below it; the longest matching
 * prefix wins. A user needs ANY ONE of the rule's permissions. Paths without a
 * rule (e.g. /dashboard) are open to every signed-in user.
 */
export type RouteRule = { prefix: string; anyOf: readonly Permission[] };

export const FORBIDDEN_PATH = "/forbidden";
export const HOME_PATH = "/dashboard";

const ADMIN_PERMISSIONS = [
  "user.manage",
  "category.manage",
  "settings.manage",
  "audit.view",
] as const satisfies readonly Permission[];

export const ROUTE_RULES: readonly RouteRule[] = [
  { prefix: "/sales/new", anyOf: ["sale.create"] },
  { prefix: "/sales", anyOf: ["sale.viewAll", "sale.viewOwnToday"] },
  { prefix: "/products/new", anyOf: ["product.edit"] },
  { prefix: "/products", anyOf: ["product.view"] },
  { prefix: "/stock", anyOf: ["stock.view"] },
  { prefix: "/requests", anyOf: ["request.create", "request.view"] },
  { prefix: "/reports", anyOf: ["report.revenue"] },
  { prefix: "/admin/users", anyOf: ["user.manage"] },
  { prefix: "/admin/categories", anyOf: ["category.manage"] },
  { prefix: "/admin/settings", anyOf: ["settings.manage"] },
  { prefix: "/admin/audit", anyOf: ["audit.view"] },
  { prefix: "/admin", anyOf: ADMIN_PERMISSIONS },
];

/** Does `pathname` equal `prefix` or sit below it (segment-aware: /sales ≠ /salesforce)? */
export function matchesPrefix(pathname: string, prefix: string): boolean {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

/** The most specific rule for a path, if any. */
export function ruleFor(pathname: string): RouteRule | undefined {
  let best: RouteRule | undefined;
  for (const rule of ROUTE_RULES) {
    if (
      matchesPrefix(pathname, rule.prefix) &&
      (!best || rule.prefix.length > best.prefix.length)
    ) {
      best = rule;
    }
  }
  return best;
}

/** May this role open this page? Signed-out users (no role) may not. */
export function canAccessPath(role: Role | null | undefined, pathname: string): boolean {
  if (!role) return false;
  const rule = ruleFor(pathname);
  if (!rule) return true;
  return rule.anyOf.some((permission) => can(role, permission));
}
