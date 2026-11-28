import type { Role } from "@prisma/client";

/** Throwaway users that exist only in the test database (see global-setup.ts). */
export const E2E_PASSWORD = "E2e-Password-123";

export const e2eUsers = {
  active: "e2e-active@test.local",
  inactive: "e2e-inactive@test.local",
  /** One per project, because the test changes the password. */
  mustChange: (project: string) => `e2e-newbie-${project}@test.local`,
  /** One ready-to-use account per role, for the app shell tests. */
  role: (role: Role) => `e2e-${role.toLowerCase()}@test.local`,
};

export const ROLE_USER_NAMES: Record<Role, string> = {
  OWNER: "Olu Owner",
  MANAGER: "Mara Manager",
  SALES: "Sam Sales",
  VIEWER: "Vic Viewer",
};

export const PROJECTS = ["mobile-360", "desktop-1280"] as const;
