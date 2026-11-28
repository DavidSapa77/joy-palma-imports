"use client";

import type { Role } from "@prisma/client";
import { createContext, useContext, type ReactNode } from "react";

import { can, type Permission } from "@/lib/permissions";

/**
 * Client-side permission checks, for showing/hiding UI only (UI spec §1.4:
 * buttons a user can't use are hidden). The server always re-checks with
 * requirePermission — never rely on this for security.
 *
 * The signed-in user's role is passed down once from a server layout:
 *   <PermissionsProvider role={session.user.role}>…</PermissionsProvider>
 */
const RoleContext = createContext<Role | null>(null);

export function PermissionsProvider({
  role,
  children,
}: {
  role: Role | null;
  children: ReactNode;
}) {
  return <RoleContext.Provider value={role}>{children}</RoleContext.Provider>;
}

/** The current user's role (null outside a provider). */
export function useRole(): Role | null {
  return useContext(RoleContext);
}

/** True if the current user's role has the permission (false outside a provider). */
export function useCan(permission: Permission): boolean {
  return can(useContext(RoleContext), permission);
}

/** Renders children only if the current user has the permission. */
export function Can({
  perm,
  children,
  fallback = null,
}: {
  perm: Permission;
  children: ReactNode;
  fallback?: ReactNode;
}) {
  return useCan(perm) ? children : fallback;
}
