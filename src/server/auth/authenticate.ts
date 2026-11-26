import type { PrismaClient, Role } from "@prisma/client";

import { logAudit } from "@/lib/audit";
import { hashPassword, verifyPassword } from "@/lib/password";

/**
 * Credential check behind the Auth.js Credentials provider.
 *
 * - Email is compared lower-cased.
 * - Unknown email and wrong password give the same result (and take the same
 *   time: a dummy hash is checked), so the response never hints which it was.
 * - Rate limit: after 5 failed attempts for the same email + IP within 15
 *   minutes, further attempts are refused until the oldest of those failures
 *   is 15 minutes old. A successful login resets the count. Attempts are stored
 *   in LoginAttempt, so the limit survives restarts.
 * - Every attempt writes an AuditLog row (LOGIN or LOGIN_FAILED).
 */

export const LOGIN_MAX_FAILURES = 5;
export const LOGIN_WINDOW_MS = 15 * 60_000;

export type AuthenticatedUser = {
  id: string;
  name: string;
  email: string;
  role: Role;
  mustChangePassword: boolean;
};

export type AuthFailureReason = "INVALID_CREDENTIALS" | "INACTIVE" | "RATE_LIMITED";

export type AuthResult =
  { ok: true; user: AuthenticatedUser } | { ok: false; reason: AuthFailureReason; retryAt?: Date };

export type AuthenticateInput = {
  email: string;
  password: string;
  ipAddress?: string | null;
  now?: Date;
};

let dummyHash: Promise<string> | undefined;
/** Hash of a random string, checked for unknown emails so timing doesn't leak existence. */
function getDummyHash(): Promise<string> {
  dummyHash ??= hashPassword(`dummy-${Math.random()}-${Date.now()}`);
  return dummyHash;
}

/** When the email+IP may try again, or null if not rate-limited. */
export async function getLockout(
  db: PrismaClient,
  email: string,
  ipAddress: string,
  now: Date = new Date(),
): Promise<Date | null> {
  const windowStart = new Date(now.getTime() - LOGIN_WINDOW_MS);
  const lastSuccess = await db.loginAttempt.findFirst({
    where: { email, ipAddress, outcome: "SUCCESS", createdAt: { gte: windowStart } },
    orderBy: { createdAt: "desc" },
    select: { createdAt: true },
  });
  const since = lastSuccess ? lastSuccess.createdAt : windowStart;
  const failures = await db.loginAttempt.findMany({
    where: { email, ipAddress, outcome: "FAILED", createdAt: { gt: since, lte: now } },
    orderBy: { createdAt: "desc" },
    take: LOGIN_MAX_FAILURES,
    select: { createdAt: true },
  });
  if (failures.length < LOGIN_MAX_FAILURES) return null;
  // Unlocks when the oldest of the last 5 failures leaves the window.
  const oldest = failures[failures.length - 1]!.createdAt;
  return new Date(oldest.getTime() + LOGIN_WINDOW_MS);
}

export async function authenticate(
  db: PrismaClient,
  input: AuthenticateInput,
): Promise<AuthResult> {
  const now = input.now ?? new Date();
  const email = input.email.trim().toLowerCase();
  const ipAddress = input.ipAddress?.trim() || "unknown";

  const recordFailure = (outcome: "FAILED" | "BLOCKED", reason: string, userId: string | null) =>
    db.$transaction([
      db.loginAttempt.create({ data: { email, ipAddress, outcome, createdAt: now } }),
      logAudit(db, {
        userId,
        action: "LOGIN_FAILED",
        entityType: "User",
        entityId: userId,
        after: { email, reason },
        ipAddress,
      }),
    ]);

  const retryAt = await getLockout(db, email, ipAddress, now);
  if (retryAt) {
    await recordFailure("BLOCKED", "RATE_LIMITED", null);
    return { ok: false, reason: "RATE_LIMITED", retryAt };
  }

  const user = await db.user.findUnique({ where: { email } });
  const passwordOk = await verifyPassword(
    input.password,
    user?.passwordHash ?? (await getDummyHash()),
  );

  if (!user || !passwordOk) {
    await recordFailure("FAILED", user ? "WRONG_PASSWORD" : "UNKNOWN_EMAIL", user?.id ?? null);
    return { ok: false, reason: "INVALID_CREDENTIALS" };
  }
  if (!user.isActive) {
    await recordFailure("FAILED", "INACTIVE", user.id);
    return { ok: false, reason: "INACTIVE" };
  }

  await db.$transaction([
    db.loginAttempt.create({ data: { email, ipAddress, outcome: "SUCCESS", createdAt: now } }),
    db.user.update({ where: { id: user.id }, data: { lastLoginAt: now } }),
    logAudit(db, {
      userId: user.id,
      action: "LOGIN",
      entityType: "User",
      entityId: user.id,
      ipAddress,
    }),
  ]);

  return {
    ok: true,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      mustChangePassword: user.mustChangePassword,
    },
  };
}
