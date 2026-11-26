import "server-only";

import type { Session } from "next-auth";

import { auth } from "@/lib/auth";
import { ForbiddenError, UnauthenticatedError, can, type Permission } from "@/lib/permissions";

export type SessionGetter = () => Promise<Session | null>;

/**
 * Builds requirePermission around a session source. Exported for tests; app
 * code uses `requirePermission` below.
 */
export function createRequirePermission(getSession: SessionGetter) {
  return async function requirePermission(permission: Permission): Promise<Session> {
    const session = await getSession();
    if (!session?.user) throw new UnauthenticatedError();
    // Users who must change their password can't do anything else first.
    if (session.user.mustChangePassword) {
      throw new ForbiddenError(permission, "PASSWORD_CHANGE_REQUIRED");
    }
    if (!can(session.user.role, permission)) throw new ForbiddenError(permission);
    return session;
  };
}

/**
 * First step of every server action (after reading input):
 *
 *   const session = await requirePermission("sale.void");
 *
 * Reads the current session and throws UnauthenticatedError (signed out) or
 * ForbiddenError (missing permission / password change pending). Returns the
 * session so the action can use session.user.id for audit rows.
 */
export const requirePermission = createRequirePermission(auth);
