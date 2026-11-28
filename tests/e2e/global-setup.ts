import { execSync } from "node:child_process";

import { PrismaClient } from "@prisma/client";

import { hashPassword } from "@/lib/password";

import { getTestDatabaseUrl } from "../integration/test-env";

import { e2eUsers, E2E_PASSWORD, PROJECTS, ROLE_USER_NAMES } from "./fixtures";

/** Migrates the test database and (re)creates the e2e users with known state. */
export default async function globalSetup(): Promise<void> {
  const url = getTestDatabaseUrl();
  execSync("pnpm exec prisma migrate deploy", {
    stdio: ["ignore", "ignore", "inherit"],
    env: { ...process.env, DATABASE_URL: url, DIRECT_URL: url },
  });

  const prisma = new PrismaClient({ datasourceUrl: url });
  try {
    const passwordHash = await hashPassword(E2E_PASSWORD);
    const users = [
      { email: e2eUsers.active, name: "Esi Active", isActive: true, mustChangePassword: false },
      {
        email: e2eUsers.inactive,
        name: "Ike Inactive",
        isActive: false,
        mustChangePassword: false,
      },
      ...PROJECTS.map((p) => ({
        email: e2eUsers.mustChange(p),
        name: "Nana New",
        isActive: true,
        mustChangePassword: true,
      })),
    ];
    for (const user of users) {
      const data = { ...user, passwordHash, role: "SALES" as const };
      await prisma.user.upsert({ where: { email: user.email }, create: data, update: data });
    }
    for (const role of ["OWNER", "MANAGER", "SALES", "VIEWER"] as const) {
      const email = e2eUsers.role(role);
      const data = {
        email,
        name: ROLE_USER_NAMES[role],
        role,
        passwordHash,
        isActive: true,
        mustChangePassword: false,
      };
      await prisma.user.upsert({ where: { email }, create: data, update: data });
    }
    // Fresh rate-limit state for every run (test database only).
    await prisma.loginAttempt.deleteMany({ where: { email: { endsWith: "@test.local" } } });
  } finally {
    await prisma.$disconnect();
  }
}
