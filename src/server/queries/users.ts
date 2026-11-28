import "server-only";

import type { Role } from "@prisma/client";

import { prisma } from "@/lib/db";
import { formatDateTime } from "@/lib/dates";

export type UserRow = {
  id: string;
  name: string;
  email: string;
  role: Role;
  isActive: boolean;
  mustChangePassword: boolean;
  /** Formatted in the business time zone, or null if never signed in. */
  lastLogin: string | null;
};

/** Admin → Users table: active users first, then by name. Never selects password hashes. */
export async function listUsers(timeZone: string): Promise<UserRow[]> {
  const users = await prisma.user.findMany({
    orderBy: [{ isActive: "desc" }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      isActive: true,
      mustChangePassword: true,
      lastLoginAt: true,
    },
  });
  return users.map(({ lastLoginAt, ...u }) => ({
    ...u,
    lastLogin: lastLoginAt ? formatDateTime(lastLoginAt, timeZone) : null,
  }));
}
