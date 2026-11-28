"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import type { z } from "zod";

import { clientIp } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { ForbiddenError, UnauthenticatedError } from "@/lib/permissions";
import { requirePermission } from "@/lib/permissions.server";
import {
  createUserSchema,
  updateUserSchema,
  userIdSchema,
  type CreateUserInput,
  type UpdateUserInput,
  type UserIdInput,
} from "@/lib/validators/users";
import {
  createUser,
  deactivateUser,
  reactivateUser,
  resetUserPassword,
  updateUser,
  UserAdminError,
  type Actor,
} from "@/server/users/manage-users";

/**
 * Admin → Users server actions (UI spec §4.14). Each one:
 * session + requirePermission("user.manage") → Zod → transaction with guards
 * and audit row (server/users/manage-users.ts) → revalidatePath.
 *
 * Expected failures come back as `{ ok: false, error, fieldErrors? }` so the
 * dialogs can show them; anything else is a bug and throws.
 */

const USERS_PATH = "/admin/users";

type FieldErrors = Partial<Record<string, string>>;
export type UserActionFailure = { ok: false; error: string; fieldErrors?: FieldErrors };
export type UserActionResult<T extends object = object> = ({ ok: true } & T) | UserActionFailure;

function validationFailure(error: z.ZodError): UserActionFailure {
  const fieldErrors: FieldErrors = {};
  for (const issue of error.issues) {
    const field = String(issue.path[0] ?? "form");
    fieldErrors[field] ??= issue.message;
  }
  return { ok: false, error: "Check the highlighted fields", fieldErrors };
}

function knownFailure(error: unknown): UserActionFailure | null {
  if (error instanceof UserAdminError) {
    return {
      ok: false,
      error: error.message,
      fieldErrors: error.field ? { [error.field]: error.message } : undefined,
    };
  }
  if (error instanceof ForbiddenError || error instanceof UnauthenticatedError) {
    return { ok: false, error: error.message };
  }
  return null;
}

/** Permission check, validation and error mapping shared by every action. */
async function run<S extends z.ZodType, T extends object>(
  schema: S,
  input: unknown,
  body: (actor: Actor, data: z.output<S>) => Promise<T>,
): Promise<UserActionResult<T>> {
  try {
    const session = await requirePermission("user.manage");
    const parsed = schema.safeParse(input);
    if (!parsed.success) return validationFailure(parsed.error);

    const actor: Actor = { id: session.user.id, ipAddress: clientIp(await headers()) };
    const result = await body(actor, parsed.data);
    revalidatePath(USERS_PATH);
    return { ok: true, ...result };
  } catch (error) {
    const failure = knownFailure(error);
    if (failure) return failure;
    throw error;
  }
}

/** Adds a user; returns the temporary password to show once. */
export async function createUserAction(input: CreateUserInput) {
  return run(createUserSchema, input, async (actor, data) => {
    const { user, temporaryPassword } = await createUser(prisma, actor, data);
    return { userId: user.id, name: user.name, email: user.email, temporaryPassword };
  });
}

export async function updateUserAction(input: UpdateUserInput) {
  return run(updateUserSchema, input, async (actor, data) => {
    await updateUser(prisma, actor, data);
    return {};
  });
}

/** New temporary password (shown once); the user must change it at next sign-in. */
export async function resetPasswordAction(input: UserIdInput) {
  return run(userIdSchema, input, async (actor, { userId }) => {
    const { user, temporaryPassword } = await resetUserPassword(prisma, actor, userId);
    return { name: user.name, email: user.email, temporaryPassword };
  });
}

export async function deactivateUserAction(input: UserIdInput) {
  return run(userIdSchema, input, async (actor, { userId }) => {
    await deactivateUser(prisma, actor, userId);
    return {};
  });
}

export async function reactivateUserAction(input: UserIdInput) {
  return run(userIdSchema, input, async (actor, { userId }) => {
    await reactivateUser(prisma, actor, userId);
    return {};
  });
}
