import type { Role } from "@prisma/client";
import { describe, expect, it } from "vitest";

import {
  activeLink,
  bottomNavForRole,
  flattenNav,
  NAV_ITEMS,
  navForRole,
  pageTitle,
} from "@/lib/navigation";
import { ROLES } from "@/lib/permissions";
import { canAccessPath, matchesPrefix, ROUTE_RULES, ruleFor } from "@/lib/routes";

/**
 * Who may open which page (UI spec §3.1 via PRD §4.1 permissions).
 *                                     OWNER  MANAGER SALES  VIEWER
 */
const Y = true;
const N = false;
// prettier-ignore
const PAGE_ACCESS: Record<string, [boolean, boolean, boolean, boolean]> = {
  "/dashboard":                       [Y,     Y,      Y,     Y],
  "/sales/new":                       [Y,     Y,      Y,     N],
  "/sales":                           [Y,     Y,      Y,     Y],
  "/sales/abc123":                    [Y,     Y,      Y,     Y],
  "/products":                        [Y,     Y,      Y,     Y],
  "/products/new":                    [Y,     Y,      N,     N],
  "/stock":                           [Y,     Y,      N,     Y],
  "/stock/in":                        [Y,     Y,      N,     Y],
  "/stock/adjustments":               [Y,     Y,      N,     Y],
  "/stock/movements":                 [Y,     Y,      N,     Y],
  "/requests":                        [Y,     Y,      Y,     Y],
  "/reports":                         [Y,     Y,      N,     Y],
  "/reports/best-sellers":            [Y,     Y,      N,     Y],
  "/reports/staff-activity":          [Y,     Y,      N,     N],
  "/admin":                           [Y,     Y,      N,     N],
  "/admin/users":                     [Y,     N,      N,     N],
  "/admin/categories":                [Y,     N,      N,     N],
  "/admin/settings":                  [Y,     N,      N,     N],
  "/admin/audit":                     [Y,     Y,      N,     N],
};

describe("route access (lib/routes.ts)", () => {
  const cells = Object.entries(PAGE_ACCESS).flatMap(([path, row]) =>
    ROLES.map((role, i) => ({ path, role, expected: row[i]! })),
  );

  it.each(cells)("$role · $path → $expected", ({ path, role, expected }) => {
    expect(canAccessPath(role, path)).toBe(expected);
  });

  it("signed-out users can open nothing", () => {
    expect(canAccessPath(null, "/dashboard")).toBe(false);
    expect(canAccessPath(undefined, "/products")).toBe(false);
  });

  it("matches whole path segments only", () => {
    expect(matchesPrefix("/sales", "/sales")).toBe(true);
    expect(matchesPrefix("/sales/new", "/sales")).toBe(true);
    expect(matchesPrefix("/salesforce", "/sales")).toBe(false);
    expect(ruleFor("/stockholm")).toBeUndefined();
  });

  it("the most specific rule wins", () => {
    expect(ruleFor("/sales/new")?.prefix).toBe("/sales/new");
    expect(ruleFor("/sales/r-1")?.prefix).toBe("/sales");
    expect(ruleFor("/admin/users/u1")?.prefix).toBe("/admin/users");
  });

  it("every rule requires at least one permission", () => {
    for (const rule of ROUTE_RULES) expect(rule.anyOf.length).toBeGreaterThan(0);
  });
});

const labels = (role: Role) => flattenNav(navForRole(role)).map((l) => l.label);

describe("navigation by role (UI spec §3.1)", () => {
  it("Owner sees everything", () => {
    expect(labels("OWNER")).toEqual([
      "Dashboard",
      "New Sale",
      "Sales",
      "Products",
      "Stock-In",
      "Adjustments",
      "Movements",
      "Requests",
      "Reports",
      "Users",
      "Categories",
      "Settings",
      "Audit Log",
    ]);
  });

  it("Manager sees everything except Users, Categories and Settings", () => {
    expect(labels("MANAGER")).toEqual([
      "Dashboard",
      "New Sale",
      "Sales",
      "Products",
      "Stock-In",
      "Adjustments",
      "Movements",
      "Requests",
      "Reports",
      "Audit Log",
    ]);
  });

  it("Sales Staff: no Stock, Reports or Admin", () => {
    expect(labels("SALES")).toEqual(["Dashboard", "New Sale", "Sales", "Products", "Requests"]);
    expect(navForRole("SALES").map((i) => i.key)).not.toContain("stock");
  });

  it("Viewer: read-only areas, no New Sale, no Admin", () => {
    expect(labels("VIEWER")).toEqual([
      "Dashboard",
      "Sales",
      "Products",
      "Stock-In",
      "Adjustments",
      "Movements",
      "Requests",
      "Reports",
    ]);
  });

  it("every visible link is a page the role may open", () => {
    for (const role of ROLES) {
      for (const link of flattenNav(navForRole(role))) {
        expect(canAccessPath(role, link.href)).toBe(true);
      }
    }
  });

  it("signed out: no navigation", () => {
    expect(navForRole(null)).toEqual([]);
  });
});

describe("mobile bottom nav", () => {
  const bottom = (role: Role) =>
    bottomNavForRole(role).map((i) => (i.raised ? `+${i.label}` : i.label));

  it("Owner and Manager: Home · Products · + Sale · Reports", () => {
    expect(bottom("OWNER")).toEqual(["Home", "Products", "+Sale", "Reports"]);
    expect(bottom("MANAGER")).toEqual(["Home", "Products", "+Sale", "Reports"]);
  });

  it("Sales Staff: Home · Products · + Sale · Requests", () => {
    expect(bottom("SALES")).toEqual(["Home", "Products", "+Sale", "Requests"]);
  });

  it("Viewer can't sell: Home · Products · Sales · Reports", () => {
    expect(bottom("VIEWER")).toEqual(["Home", "Products", "Sales", "Reports"]);
  });
});

describe("active link and page title", () => {
  const all = flattenNav(NAV_ITEMS);

  it("picks the most specific link", () => {
    expect(activeLink(all, "/sales/new")?.key).toBe("new-sale");
    expect(activeLink(all, "/sales/r-123")?.key).toBe("sales");
    expect(activeLink(all, "/stock/in")?.key).toBe("stock-in");
    expect(activeLink(all, "/nowhere")).toBeUndefined();
  });

  it("titles pages from the nav", () => {
    expect(pageTitle("/dashboard")).toBe("Dashboard");
    expect(pageTitle("/admin/audit")).toBe("Audit Log");
    expect(pageTitle("/sales/new")).toBe("New Sale");
  });
});
