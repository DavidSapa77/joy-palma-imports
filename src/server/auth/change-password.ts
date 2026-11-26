import type { PrismaClient } from "@prisma/client";

import { logAudit } from "@/lib/audit";
import { hashPassword, verifyPassword } from "@/lib/password";
import { setPasswordSchema } from "@/lib/validators/auth";

export type ChangeOwnPasswordInput = {
  userId: string;
  newPassword: string;
  confirmPassword: string;
  ipAddress?: string | null;
};

export type ChangeOwnPasswordResult =
  | { ok: true }
  | {
      ok: false;
      fieldErrors: Partial<Record<"newPassword" | "confirmPassword", string>>;
    };

/**
 * A signed-in user sets a new password for themselves (forced after a reset,
 * or voluntary). Min 10 characters, must be confirmed, must differ from the
 * current one. Clears mustChangePassword and writes an audit row.
 */
export async function changeOwnPassword(
  db: PrismaClient,
  input: ChangeOwnPasswordInput,
): Promise<ChangeOwnPasswordResult> {
  const parsed = setPasswordSchema.safeParse(input);
  if (!parsed.success) {
    const fieldErrors: Partial<Record<"newPassword" | "confirmPassword", string>> = {};
    for (const issue of parsed.error.issues) {
      const field = issue.path[0];
      if ((field === "newPassword" || field === "confirmPassword") && !fieldErrors[field]) {
        fieldErrors[field] = issue.message;
      }
    }
    return { ok: false, fieldErrors };
  }

  const user = await db.user.findUnique({ where: { id: input.userId } });
  if (!user || !user.isActive) throw new Error("User not found or inactive");

  if (await verifyPassword(parsed.data.newPassword, user.passwordHash)) {
    return {
      ok: false,
      fieldErrors: { newPassword: "Choose a password you haven't used for this account" },
    };
  }

  const passwordHash = await hashPassword(parsed.data.newPassword);
  await db.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: user.id },
      data: { passwordHash, mustChangePassword: false },
    });
    await logAudit(tx, {
      userId: user.id,
      action: "UPDATE",
      entityType: "User",
      entityId: user.id,
      before: { mustChangePassword: user.mustChangePassword },
      after: { mustChangePassword: false, passwordChanged: true },
      ipAddress: input.ipAddress ?? null,
    });
  });
  return { ok: true };
}
