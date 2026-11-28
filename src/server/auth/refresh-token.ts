import type { PrismaClient } from "@prisma/client";
import type { JWT } from "next-auth/jwt";

/** How often a signed-in session re-reads the user (role, active, mustChangePassword). */
export const USER_RECHECK_MS = 60_000;

/**
 * Keeps a session token in step with the database: at most once a minute
 * (or immediately when `force` is set, e.g. after `update()`), re-read the
 * user. Returns null — which ends the session — when the user was
 * deactivated or no longer exists, so deactivation, role changes and
 * password resets take effect without a new login.
 */
export async function refreshSessionToken(
  db: PrismaClient,
  token: JWT,
  { force = false, now = Date.now() }: { force?: boolean; now?: number } = {},
): Promise<JWT | null> {
  const due = now - (token.checkedAt ?? 0) > USER_RECHECK_MS;
  if (!force && !due) return token;

  const user = await db.user.findUnique({
    where: { id: token.id },
    select: { name: true, email: true, role: true, isActive: true, mustChangePassword: true },
  });
  if (!user || !user.isActive) return null;

  return {
    ...token,
    name: user.name,
    email: user.email,
    role: user.role,
    mustChangePassword: user.mustChangePassword,
    checkedAt: now,
  };
}
