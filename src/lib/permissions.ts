import type { Role } from "@prisma/client";

/**
 * Role → permission map: docs/PRD.md §4.1 (permission matrix).
 *
 * This file is pure (no database, no session) so it can be imported anywhere,
 * including client components. Server-side enforcement lives in
 * lib/permissions.server.ts (requirePermission); the <Can> component and
 * useCan() hook live in components/auth/can.tsx.
 *
 * Every cell is pinned by tests/unit/permissions.test.ts — change a cell there
 * and here together, deliberately.
 *
 * Not permissions (every signed-in user): log in, change own password, see the
 * business name. Nobody may change the price on a sale line, so no permission
 * exists for it (prices always come from the product).
 */

export const PERMISSIONS = [
  // Products
  "product.view", //            View products & stock levels
  "product.edit", //            Create / edit product details (name, category, SKU)
  "product.archive", //         Archive (and restore) a product
  "product.price.setInitial", // Set the selling price when creating a product
  "product.price.change", //    Change the selling price of an existing product
  "product.cost.view", //       See cost price (and margins)
  "product.cost.setInitial", // Set the cost price when creating a product (note 1)
  "product.cost.change", //     Edit the cost price of an existing product directly (note 1)
  "category.manage", //         Create / rename / archive categories (note 2)
  // Stock
  "stock.view", //              Stock history: stock-ins, adjustments, movement ledger
  "stock.in", //                Record a stock-in (new shipment)
  "stock.in.updateCost", //     Let a stock-in update the product's cost price (note 1)
  "stock.adjust", //            Manual stock adjustment
  // Sales
  "sale.create", //             Record a sale
  "sale.discount", //           Apply a discount
  "sale.backdate", //           Set an earlier date/time on a sale
  "sale.void", //               Void a sale
  "sale.viewAll", //            Sales history: everyone's, any date
  "sale.viewOwnToday", //       Sales history: only own sales from today
  // Customer requests
  "request.create", //          Log a customer request
  "request.view", //            See the requests list (note 3)
  "request.manage", //          Change request status (fulfilled / dismissed) (note 4)
  // Reports
  "report.revenue", //          Revenue reports
  "report.profit", //           Profit / cost reports
  "report.export", //           Export reports (CSV / PDF)
  // Admin
  "user.manage", //             Users & roles
  "settings.manage", //         Business settings
  "audit.view", //              Audit log
] as const;

export type Permission = (typeof PERMISSIONS)[number];

export const ROLES = ["OWNER", "MANAGER", "SALES", "VIEWER"] as const satisfies readonly Role[];

/** Display names for the role badge (PRD §4). */
export const ROLE_LABELS: Readonly<Record<Role, string>> = {
  OWNER: "Owner",
  MANAGER: "Manager",
  SALES: "Sales Staff",
  VIEWER: "Viewer",
};

/*
 * Ambiguities in the PRD matrix — the stricter option is used:
 *
 * 1. Cost price (owner decision, replaces the original strict reading of
 *    "Set or view cost price: Owner ✅ · Manager ✅ (view) · Viewer ✅ (view)"):
 *    - Owner and Manager set the cost price when creating a product
 *      (product.cost.setInitial; the cost is required when a Manager creates one).
 *    - Owner and Manager may let a stock-in update the product's cost price to
 *      the shipment's unit cost (stock.in.updateCost), recorded in
 *      PriceHistory and the audit log.
 *    - Editing the cost price of an existing product directly is Owner-only
 *      (product.cost.change).
 * 2. Categories: PRD F2 says "managed by Owner/Manager", but UI spec §3.1 puts
 *    Categories under Admin, where the Manager sees only the Audit Log.
 *    → Owner only.
 * 3. Viewing the requests list has no matrix row. UI spec §3.1 gives Viewer
 *    "view" and Sales "log". → Owner, Manager, Viewer may view the list;
 *    Sales Staff can log requests but not browse them.
 * 4. Changing request status has no matrix row; PLAN 7.2 says Owner/Manager.
 *    → Owner, Manager.
 * 5. "View sales history: Sales ✅ (own, today)". → Sales Staff get
 *    sale.viewOwnToday only, never sale.viewAll.
 */
const OWNER_ONLY: readonly Permission[] = [
  "product.price.change",
  "product.cost.change",
  "category.manage",
  "user.manage",
  "settings.manage",
];

const MANAGER: readonly Permission[] = [
  "product.view",
  "product.edit",
  "product.archive",
  "product.price.setInitial",
  "product.cost.view",
  "product.cost.setInitial",
  "stock.view",
  "stock.in",
  "stock.in.updateCost",
  "stock.adjust",
  "sale.create",
  "sale.discount",
  "sale.backdate",
  "sale.void",
  "sale.viewAll",
  "request.create",
  "request.view",
  "request.manage",
  "report.revenue",
  "report.profit",
  "report.export",
  "audit.view",
];

export const ROLE_PERMISSIONS: Readonly<Record<Role, ReadonlySet<Permission>>> = {
  OWNER: new Set<Permission>([...MANAGER, ...OWNER_ONLY]),
  MANAGER: new Set<Permission>(MANAGER),
  SALES: new Set<Permission>([
    "product.view",
    "sale.create",
    "sale.viewOwnToday",
    "request.create",
  ]),
  VIEWER: new Set<Permission>([
    "product.view",
    "product.cost.view",
    "stock.view",
    "sale.viewAll",
    "request.view",
    "report.revenue",
    "report.profit",
    "report.export",
  ]),
};

/** Does this role have this permission? Unknown roles have none. */
export function can(role: Role | null | undefined, permission: Permission): boolean {
  if (!role) return false;
  return ROLE_PERMISSIONS[role]?.has(permission) ?? false;
}

// ---------------------------------------------------------------------------
// Errors (thrown by requirePermission / assertCan)
// ---------------------------------------------------------------------------

/** No signed-in user. Actions should send the user to /login. */
export class UnauthenticatedError extends Error {
  override name = "UnauthenticatedError";
  readonly code = "UNAUTHENTICATED";
  constructor(message = "You need to sign in") {
    super(message);
  }
}

export type ForbiddenReason = "MISSING_PERMISSION" | "PASSWORD_CHANGE_REQUIRED";

/** Signed in, but not allowed to do this. */
export class ForbiddenError extends Error {
  override name = "ForbiddenError";
  readonly code = "FORBIDDEN";
  constructor(
    readonly permission: Permission,
    readonly reason: ForbiddenReason = "MISSING_PERMISSION",
    message = reason === "PASSWORD_CHANGE_REQUIRED"
      ? "Set a new password before continuing"
      : "You don't have permission to do that",
  ) {
    super(message);
  }
}

/** Throws ForbiddenError unless the role has the permission. */
export function assertCan(role: Role | null | undefined, permission: Permission): void {
  if (!can(role, permission)) throw new ForbiddenError(permission);
}
