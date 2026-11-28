import { Prisma, type PrismaClient, type Role, type User } from "@prisma/client";

import { logAudit } from "@/lib/audit";
import type { TransactionClient } from "@/lib/counters";
import { hashPassword } from "@/lib/password";
import { generateTemporaryPassword } from "@/lib/temporary-password";

/**
 * User administration (PRD F1, UI spec §4.14). Callers (server actions) check
 * `user.manage` and validate input first; these functions enforce the
 * business guards inside one transaction and write the audit row:
 *
 * - nobody can deactivate themselves or change their own role;
 * - there is always at least one active Owner (the Owner rows are locked, so
 *   two Owners demoting each other at the same time can't both succeed);
 * - emails are unique, case-insensitively.
 *
 * Passwords and hashes never reach the audit log (and lib/audit.ts redacts
 * password-like keys as a second line of defence).
 */

export type UserAdminErrorCode =
  | "USER_NOT_FOUND"
  | "EMAIL_TAKEN"
  | "SELF_DEACTIVATE"
  | "SELF_ROLE_CHANGE"
  | "SELF_RESET"
  | "LAST_OWNER";

export class UserAdminError extends Error {
  override name = "UserAdminError";
  constructor(
    readonly code: UserAdminErrorCode,
    message: string,
    /** Form field the message belongs to, if any. */
    readonly field?: "email" | "role",
  ) {
    super(message);
  }
}

export type Actor = { id: string; ipAddress?: string | null };

/** Fields safe to show and to put in the audit log. */
const PUBLIC_FIELDS = {
  id: true,
  name: true,
  email: true,
  role: true,
  isActive: true,
  mustChangePassword: true,
} as const satisfies Prisma.UserSelect;

type PublicUser = Pick<User, keyof typeof PUBLIC_FIELDS>;

/**
 * Locks the target row (and, when the target is an Owner, every active Owner
 * row first, always in id order, so concurrent Owner changes queue up instead
 * of deadlocking). Returns the locked user and the active Owner ids.
 */
async function lockUser(
  tx: TransactionClient,
  userId: string,
): Promise<{ user: PublicUser; activeOwnerIds: string[] }> {
  const lockOwners = () =>
    tx.$queryRaw<{ id: string }[]>`
      SELECT "id" FROM "User" WHERE "role" = 'OWNER' AND "isActive" = true ORDER BY "id" FOR UPDATE`;

  const peek = await tx.user.findUnique({ where: { id: userId }, select: { role: true } });
  if (!peek) throw new UserAdminError("USER_NOT_FOUND", "That user no longer exists");
  let owners = peek.role === "OWNER" ? await lockOwners() : null;

  const rows = await tx.$queryRaw<{ id: string }[]>`
    SELECT "id" FROM "User" WHERE "id" = ${userId} FOR UPDATE`;
  if (rows.length === 0) throw new UserAdminError("USER_NOT_FOUND", "That user no longer exists");
  const user = await tx.user.findUniqueOrThrow({ where: { id: userId }, select: PUBLIC_FIELDS });
  // Became an Owner between the peek and the lock (rare): lock the Owners now.
  if (!owners && user.role === "OWNER") owners = await lockOwners();
  return { user, activeOwnerIds: (owners ?? []).map((o) => o.id) };
}

/** Throws LAST_OWNER if `target` is an active Owner and no other active Owner exists. */
function assertNotLastActiveOwner(target: PublicUser, activeOwnerIds: string[]): void {
  if (target.role !== "OWNER" || !target.isActive) return;
  if (activeOwnerIds.every((id) => id === target.id)) {
    throw new UserAdminError(
      "LAST_OWNER",
      "This is the only active Owner — make someone else Owner first",
      "role",
    );
  }
}

function emailTaken(): UserAdminError {
  return new UserAdminError(
    "EMAIL_TAKEN",
    "A user with this email already exists (it may be deactivated — reactivate it instead)",
    "email",
  );
}

export type CreateUserData = { name: string; email: string; role: Role };

/** Creates a user with a temporary password they must change at first sign-in. */
export async function createUser(db: PrismaClient, actor: Actor, data: CreateUserData) {
  const email = data.email.trim().toLowerCase();
  const temporaryPassword = generateTemporaryPassword();
  const passwordHash = await hashPassword(temporaryPassword);

  try {
    const user = await db.$transaction(async (tx) => {
      const existing = await tx.user.findFirst({
        where: { email: { equals: email, mode: "insensitive" } },
        select: { id: true },
      });
      if (existing) throw emailTaken();

      const created = await tx.user.create({
        data: {
          name: data.name.trim(),
          email,
          role: data.role,
          passwordHash,
          mustChangePassword: true,
        },
        select: PUBLIC_FIELDS,
      });
      await logAudit(tx, {
        userId: actor.id,
        action: "CREATE",
        entityType: "User",
        entityId: created.id,
        after: created,
        ipAddress: actor.ipAddress,
      });
      return created;
    });
    return { user, temporaryPassword };
  } catch (error) {
    // Two creates racing for the same email: the unique index catches the second.
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      throw emailTaken();
    }
    throw error;
  }
}

export type UpdateUserData = { userId: string; name: string; role: Role };

/** Edits name and role. Returns the user; no audit row if nothing changed. */
export async function updateUser(db: PrismaClient, actor: Actor, data: UpdateUserData) {
  return db.$transaction(async (tx) => {
    const { user: before, activeOwnerIds } = await lockUser(tx, data.userId);
    const name = data.name.trim();
    const roleChanged = before.role !== data.role;

    if (roleChanged && before.id === actor.id) {
      throw new UserAdminError("SELF_ROLE_CHANGE", "You can't change your own role", "role");
    }
    if (roleChanged) assertNotLastActiveOwner(before, activeOwnerIds);
    if (!roleChanged && name === before.name) return before;

    const after = await tx.user.update({
      where: { id: before.id },
      data: { name, role: data.role },
      select: PUBLIC_FIELDS,
    });
    await logAudit(tx, {
      userId: actor.id,
      action: "UPDATE",
      entityType: "User",
      entityId: before.id,
      before: { name: before.name, role: before.role },
      after: { name: after.name, role: after.role },
      ipAddress: actor.ipAddress,
    });
    return after;
  });
}

/**
 * Deactivates a user. They can't sign in any more, and an open session ends
 * at its next re-check (lib/auth.ts, at most a minute).
 */
export async function deactivateUser(db: PrismaClient, actor: Actor, userId: string) {
  return db.$transaction(async (tx) => {
    const { user: before, activeOwnerIds } = await lockUser(tx, userId);
    if (before.id === actor.id) {
      throw new UserAdminError("SELF_DEACTIVATE", "You can't deactivate your own account");
    }
    if (!before.isActive) return before;
    assertNotLastActiveOwner(before, activeOwnerIds);

    const after = await tx.user.update({
      where: { id: before.id },
      data: { isActive: false },
      select: PUBLIC_FIELDS,
    });
    await logAudit(tx, {
      userId: actor.id,
      action: "DEACTIVATE",
      entityType: "User",
      entityId: before.id,
      before: { isActive: true },
      after: { isActive: false },
      ipAddress: actor.ipAddress,
    });
    return after;
  });
}

export async function reactivateUser(db: PrismaClient, actor: Actor, userId: string) {
  return db.$transaction(async (tx) => {
    const { user: before } = await lockUser(tx, userId);
    if (before.isActive) return before;

    const after = await tx.user.update({
      where: { id: before.id },
      data: { isActive: true },
      select: PUBLIC_FIELDS,
    });
    await logAudit(tx, {
      userId: actor.id,
      action: "RESTORE",
      entityType: "User",
      entityId: before.id,
      before: { isActive: false },
      after: { isActive: true },
      ipAddress: actor.ipAddress,
    });
    return after;
  });
}

/**
 * Gives a user a new temporary password (shown once to the Owner) and makes
 * them choose their own at next sign-in. Their open session is sent to
 * /set-password at its next re-check.
 */
export async function resetUserPassword(db: PrismaClient, actor: Actor, userId: string) {
  if (userId === actor.id) {
    throw new UserAdminError(
      "SELF_RESET",
      "To change your own password, use Change password in your account menu",
    );
  }
  const temporaryPassword = generateTemporaryPassword();
  const passwordHash = await hashPassword(temporaryPassword);

  const user = await db.$transaction(async (tx) => {
    const { user: before } = await lockUser(tx, userId);
    const after = await tx.user.update({
      where: { id: before.id },
      data: { passwordHash, mustChangePassword: true },
      select: PUBLIC_FIELDS,
    });
    await logAudit(tx, {
      userId: actor.id,
      action: "PASSWORD_RESET",
      entityType: "User",
      entityId: before.id,
      before: { mustChangePassword: before.mustChangePassword },
      after: { mustChangePassword: true, passwordReset: true },
      ipAddress: actor.ipAddress,
    });
    return after;
  });
  return { user, temporaryPassword };
}
