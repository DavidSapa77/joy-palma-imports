import "server-only";

import type { Session } from "next-auth";
import { forbidden } from "next/navigation";

import { canAccessPath } from "@/lib/routes";
import { requireSession } from "@/lib/session";

/**
 * Server-side page guard. Call it at the top of every role-restricted page or
 * section layout with the page's own path:
 *
 *   await guardRoute("/stock/in");
 *
 * Signed-out users go to /login, pending password changes to /set-password,
 * and roles without access (lib/routes.ts) get the friendly 403 page
 * (app/(app)/forbidden.tsx) with HTTP status 403.
 */
export async function guardRoute(path: string): Promise<Session> {
  const session = await requireSession();
  if (!canAccessPath(session.user.role, path)) forbidden();
  return session;
}
