import { z } from "zod";

import { ROLES } from "@/lib/permissions";

/** Admin → Users forms (UI spec §4.14). Shared by the dialogs and the server actions. */

const name = z
  .string()
  .trim()
  .min(1, "Enter the person's name")
  .max(100, "Use at most 100 characters");

const role = z.enum(ROLES, { message: "Choose a role" });

const userId = z.string().min(1).max(64);

export const createUserSchema = z.object({
  name,
  email: z
    .string()
    .trim()
    .toLowerCase()
    .pipe(z.email("Enter a valid email address").max(254, "Use at most 254 characters")),
  role,
});
export type CreateUserInput = z.input<typeof createUserSchema>;

export const updateUserSchema = z.object({ userId, name, role });
export type UpdateUserInput = z.input<typeof updateUserSchema>;

export const userIdSchema = z.object({ userId });
export type UserIdInput = z.input<typeof userIdSchema>;
