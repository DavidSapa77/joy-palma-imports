import type { Role } from "@prisma/client";
import type { Session } from "next-auth";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { Can, PermissionsProvider, useCan } from "@/components/auth/can";
import {
  assertCan,
  can,
  ForbiddenError,
  PERMISSIONS,
  ROLE_PERMISSIONS,
  ROLES,
  UnauthenticatedError,
  type Permission,
} from "@/lib/permissions";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
const { createRequirePermission } = await import("@/lib/permissions.server");

/**
 * The permission matrix, cell by cell: docs/PRD.md §4.1 (with the ambiguity
 * decisions documented in src/lib/permissions.ts). Changing any cell here must
 * be a deliberate, reviewed decision.
 *
 *                                   OWNER  MANAGER SALES  VIEWER
 */
const Y = true;
const N = false;
// prettier-ignore
const MATRIX: Record<Permission, [boolean, boolean, boolean, boolean]> = {
  "product.view":                    [Y,     Y,      Y,     Y],
  "product.edit":                    [Y,     Y,      N,     N],
  "product.archive":                 [Y,     Y,      N,     N],
  "product.price.setInitial":        [Y,     Y,      N,     N],
  "product.price.change":            [Y,     N,      N,     N],
  "product.cost.view":               [Y,     Y,      N,     Y],
  "product.cost.setInitial":         [Y,     Y,      N,     N],
  "product.cost.change":             [Y,     N,      N,     N],
  "category.manage":                 [Y,     N,      N,     N],
  "stock.view":                      [Y,     Y,      N,     Y],
  "stock.in":                        [Y,     Y,      N,     N],
  "stock.in.updateCost":             [Y,     Y,      N,     N],
  "stock.adjust":                    [Y,     Y,      N,     N],
  "sale.create":                     [Y,     Y,      Y,     N],
  "sale.discount":                   [Y,     Y,      N,     N],
  "sale.backdate":                   [Y,     Y,      N,     N],
  "sale.void":                       [Y,     Y,      N,     N],
  "sale.viewAll":                    [Y,     Y,      N,     Y],
  "sale.viewOwnToday":               [N,     N,      Y,     N],
  "request.create":                  [Y,     Y,      Y,     N],
  "request.view":                    [Y,     Y,      N,     Y],
  "request.manage":                  [Y,     Y,      N,     N],
  "report.revenue":                  [Y,     Y,      N,     Y],
  "report.profit":                   [Y,     Y,      N,     Y],
  "report.export":                   [Y,     Y,      N,     Y],
  "report.staff":                    [Y,     Y,      N,     N],
  "user.manage":                     [Y,     N,      N,     N],
  "settings.manage":                 [Y,     N,      N,     N],
  "audit.view":                      [Y,     Y,      N,     N],
};

const cells = PERMISSIONS.flatMap((permission) =>
  ROLES.map((role, i) => ({ role, permission, expected: MATRIX[permission][i]! })),
);

describe("permission matrix (PRD §4.1)", () => {
  it("the test matrix covers exactly the defined permissions", () => {
    expect(Object.keys(MATRIX).sort()).toEqual([...PERMISSIONS].sort());
    expect(new Set(PERMISSIONS).size).toBe(PERMISSIONS.length);
  });

  it("covers every role", () => {
    expect([...ROLES].sort()).toEqual(Object.keys(ROLE_PERMISSIONS).sort());
  });

  it.each(cells)("$role · $permission → $expected", ({ role, permission, expected }) => {
    expect(can(role, permission)).toBe(expected);
  });

  it("roles hold no permissions outside the list", () => {
    for (const role of ROLES) {
      for (const permission of ROLE_PERMISSIONS[role]) {
        expect(PERMISSIONS).toContain(permission);
      }
    }
  });
});

describe("key business rules", () => {
  it("only the Owner can change an existing selling price; Manager sets it only at creation", () => {
    expect(ROLES.filter((r) => can(r, "product.price.change"))).toEqual(["OWNER"]);
    expect(ROLES.filter((r) => can(r, "product.price.setInitial"))).toEqual(["OWNER", "MANAGER"]);
  });

  it("Managers record cost at creation and via stock-in; only the Owner edits it directly", () => {
    expect(ROLES.filter((r) => can(r, "product.cost.setInitial"))).toEqual(["OWNER", "MANAGER"]);
    expect(ROLES.filter((r) => can(r, "stock.in.updateCost"))).toEqual(["OWNER", "MANAGER"]);
    expect(ROLES.filter((r) => can(r, "product.cost.change"))).toEqual(["OWNER"]);
  });

  it("Sales Staff never see cost or profit", () => {
    for (const p of [
      "product.cost.view",
      "product.cost.setInitial",
      "product.cost.change",
      "stock.in.updateCost",
      "report.profit",
    ] as const) {
      expect(can("SALES", p)).toBe(false);
    }
  });

  it("Viewer is read-only: no create/edit/void/adjust/manage permission", () => {
    const readOnly = new Set<Permission>([
      "product.view",
      "product.cost.view",
      "stock.view",
      "sale.viewAll",
      "request.view",
      "report.revenue",
      "report.profit",
      "report.export",
    ]);
    expect([...ROLE_PERMISSIONS.VIEWER].every((p) => readOnly.has(p))).toBe(true);
  });

  it("the Owner has every permission except the Sales-only 'own sales today' view", () => {
    expect(PERMISSIONS.filter((p) => !can("OWNER", p))).toEqual(["sale.viewOwnToday"]);
  });
});

describe("can / assertCan", () => {
  it("is false for a missing or unknown role", () => {
    expect(can(null, "product.view")).toBe(false);
    expect(can(undefined, "product.view")).toBe(false);
    expect(can("JANITOR" as Role, "product.view")).toBe(false);
  });

  it("assertCan throws ForbiddenError with the permission", () => {
    expect(() => assertCan("MANAGER", "sale.void")).not.toThrow();
    const error = (() => {
      try {
        assertCan("SALES", "sale.void");
      } catch (e) {
        return e;
      }
    })();
    expect(error).toBeInstanceOf(ForbiddenError);
    expect(error).toMatchObject({ code: "FORBIDDEN", permission: "sale.void" });
  });
});

describe("requirePermission", () => {
  const session = (role: Role, mustChangePassword = false): Session => ({
    expires: new Date(Date.now() + 3_600_000).toISOString(),
    user: { id: "u1", name: "Ama", email: "a@b.c", role, mustChangePassword },
  });

  it("returns the session when allowed", async () => {
    const s = session("MANAGER");
    const requirePermission = createRequirePermission(async () => s);
    await expect(requirePermission("sale.void")).resolves.toBe(s);
  });

  it("throws UnauthenticatedError when signed out", async () => {
    const requirePermission = createRequirePermission(async () => null);
    await expect(requirePermission("product.view")).rejects.toBeInstanceOf(UnauthenticatedError);
    await expect(requirePermission("product.view")).rejects.toMatchObject({
      code: "UNAUTHENTICATED",
    });
  });

  it("throws ForbiddenError when the role lacks the permission", async () => {
    const requirePermission = createRequirePermission(async () => session("SALES"));
    await expect(requirePermission("sale.void")).rejects.toMatchObject({
      name: "ForbiddenError",
      code: "FORBIDDEN",
      permission: "sale.void",
      reason: "MISSING_PERMISSION",
    });
  });

  it("blocks users who still have to change their password, even the Owner", async () => {
    const requirePermission = createRequirePermission(async () => session("OWNER", true));
    await expect(requirePermission("product.view")).rejects.toMatchObject({
      code: "FORBIDDEN",
      reason: "PASSWORD_CHANGE_REQUIRED",
    });
  });
});

describe("<Can> and useCan", () => {
  const render = (role: Role | null, perm: Permission) =>
    renderToStaticMarkup(
      <PermissionsProvider role={role}>
        <Can perm={perm} fallback="no">
          yes
        </Can>
      </PermissionsProvider>,
    );

  it("renders children only when the role has the permission", () => {
    expect(render("OWNER", "product.price.change")).toBe("yes");
    expect(render("MANAGER", "product.price.change")).toBe("no");
    expect(render("SALES", "sale.create")).toBe("yes");
    expect(render("VIEWER", "sale.create")).toBe("no");
  });

  it("renders nothing (or the fallback) when signed out or outside a provider", () => {
    expect(render(null, "product.view")).toBe("no");
    expect(renderToStaticMarkup(<Can perm="product.view">yes</Can>)).toBe("");
  });

  it("useCan reads the provider's role", () => {
    function Probe() {
      return useCan("audit.view") ? "can" : "cannot";
    }
    const html = (role: Role) =>
      renderToStaticMarkup(
        <PermissionsProvider role={role}>
          <Probe />
        </PermissionsProvider>,
      );
    expect(html("MANAGER")).toBe("can");
    expect(html("SALES")).toBe("cannot");
  });
});
