import { randomUUID } from "node:crypto";

import { PrismaClient, type Role } from "@prisma/client";
import type { Session } from "next-auth";
import type { JWT } from "next-auth/jwt";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { getTestDatabaseUrl } from "./test-env";

/**
 * Admin → Users server actions against the real test database, with the
 * session mocked. Covers requirePermission, validation, every guard, the
 * audit rows (no secrets) and session end after deactivation.
 */

// lib/db reads DATABASE_URL when first imported (below, dynamically): point it at the test DB.
const testUrl = getTestDatabaseUrl();
process.env.DATABASE_URL = testUrl;

const mocks = vi.hoisted(() => ({ session: null as Session | null }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/auth", () => ({
  auth: vi.fn(async () => mocks.session),
  clientIp: () => "203.0.113.7",
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/headers", () => ({ headers: async () => new Headers() }));

const actions = await import("@/server/actions/users");
const { hashPassword, verifyPassword } = await import("@/lib/password");
const { TEMPORARY_PASSWORD_PATTERN } = await import("@/lib/temporary-password");
const { authenticate } = await import("@/server/auth/authenticate");
const { refreshSessionToken, USER_RECHECK_MS } = await import("@/server/auth/refresh-token");
const { revalidatePath } = await import("next/cache");

let prisma: PrismaClient;
let passwordHash: string;
const run = randomUUID().slice(0, 8);
const email = (label: string) => `${label}-${run}-${randomUUID().slice(0, 6)}@test.local`;

async function makeUser(role: Role, overrides: { isActive?: boolean; name?: string } = {}) {
  return prisma.user.create({
    data: {
      name: overrides.name ?? `${role} ${run}`,
      email: email(role.toLowerCase()),
      passwordHash,
      role,
      isActive: overrides.isActive ?? true,
      mustChangePassword: false,
    },
  });
}

/** Signs in (mock) as this user; `role` can differ from the database to model a stale session. */
function actAs(user: { id: string; name: string; email: string; role: Role }, role = user.role) {
  mocks.session = {
    expires: new Date(Date.now() + 3_600_000).toISOString(),
    user: { id: user.id, name: user.name, email: user.email, role, mustChangePassword: false },
  };
}

const auditRows = (entityId: string) =>
  prisma.auditLog.findMany({ where: { entityId }, orderBy: { createdAt: "asc" } });

function expectNoSecrets(value: unknown, ...secrets: string[]) {
  const json = JSON.stringify(value);
  expect(json).not.toMatch(/passwordHash|\$2[aby]\$/);
  for (const s of secrets) expect(json).not.toContain(s);
}

/**
 * Temporarily deactivates every other active Owner so the "last active
 * Owner" guard can be exercised on a shared test database; restores them.
 */
async function withOnlyOwners<T>(keep: string[], body: () => Promise<T>): Promise<T> {
  const others = await prisma.user.findMany({
    where: { role: "OWNER", isActive: true, id: { notIn: keep } },
    select: { id: true },
  });
  const ids = others.map((o) => o.id);
  await prisma.user.updateMany({ where: { id: { in: ids } }, data: { isActive: false } });
  try {
    return await body();
  } finally {
    await prisma.user.updateMany({ where: { id: { in: ids } }, data: { isActive: true } });
  }
}

beforeAll(async () => {
  prisma = new PrismaClient({ datasourceUrl: testUrl });
  passwordHash = await hashPassword("Known-Password-1");
});

afterAll(async () => {
  await prisma.$disconnect();
});

beforeEach(() => {
  mocks.session = null;
  vi.mocked(revalidatePath).mockClear();
});

describe("permission checks", () => {
  it.each(["MANAGER", "SALES", "VIEWER"] as const)("%s can't manage users", async (role) => {
    const actor = await makeUser(role);
    const target = await makeUser("SALES");
    actAs(actor);
    const newEmail = email("blocked");

    for (const result of [
      await actions.createUserAction({ name: "X", email: newEmail, role: "OWNER" }),
      await actions.updateUserAction({ userId: target.id, name: "X", role: "OWNER" }),
      await actions.resetPasswordAction({ userId: target.id }),
      await actions.deactivateUserAction({ userId: target.id }),
      await actions.reactivateUserAction({ userId: target.id }),
    ]) {
      expect(result).toEqual({ ok: false, error: "You don't have permission to do that" });
    }
    expect(await prisma.user.findUnique({ where: { email: newEmail } })).toBeNull();
    expect(await prisma.user.findUniqueOrThrow({ where: { id: target.id } })).toMatchObject({
      role: "SALES",
      isActive: true,
      passwordHash,
    });
    expect(await auditRows(target.id)).toEqual([]);
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("signed-out callers and Owners with a pending password change are refused", async () => {
    const result = await actions.createUserAction({ name: "X", email: email("x"), role: "SALES" });
    expect(result).toMatchObject({ ok: false, error: "You need to sign in" });

    const owner = await makeUser("OWNER");
    mocks.session = {
      expires: new Date(Date.now() + 3_600_000).toISOString(),
      user: { ...owner, mustChangePassword: true },
    };
    expect(
      await actions.createUserAction({ name: "X", email: email("x"), role: "SALES" }),
    ).toMatchObject({ ok: false, error: "Set a new password before continuing" });
  });
});

describe("create user", () => {
  it("creates the user with a temporary password they must change; audit has no secrets", async () => {
    const owner = await makeUser("OWNER");
    actAs(owner);
    const address = email("New.Person");

    const result = await actions.createUserAction({
      name: "  Kofi Mensah ",
      email: `  ${address.toUpperCase()} `,
      role: "SALES",
    });
    if (!result.ok) throw new Error(result.error);

    expect(result.temporaryPassword).toMatch(TEMPORARY_PASSWORD_PATTERN);
    expect(result.email).toBe(address.toLowerCase());
    const user = await prisma.user.findUniqueOrThrow({ where: { id: result.userId } });
    expect(user).toMatchObject({
      name: "Kofi Mensah",
      email: address.toLowerCase(),
      role: "SALES",
      isActive: true,
      mustChangePassword: true,
    });
    expect(await verifyPassword(result.temporaryPassword, user.passwordHash)).toBe(true);
    expect(revalidatePath).toHaveBeenCalledWith("/admin/users");

    const [audit] = await auditRows(user.id);
    expect(audit).toMatchObject({
      action: "CREATE",
      entityType: "User",
      userId: owner.id,
      ipAddress: "203.0.113.7",
    });
    expect(audit!.after).toMatchObject({ email: address.toLowerCase(), role: "SALES" });
    expectNoSecrets([audit!.before, audit!.after], result.temporaryPassword);
  });

  it("rejects invalid input with field errors", async () => {
    actAs(await makeUser("OWNER"));
    const result = await actions.createUserAction({
      name: "  ",
      email: "not-an-email",
      role: "ADMIN" as Role,
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(Object.keys(result.fieldErrors ?? {}).sort()).toEqual(["email", "name", "role"]);
  });

  it("emails are unique, case-insensitively — including deactivated accounts", async () => {
    const owner = await makeUser("OWNER");
    actAs(owner);
    const existing = await makeUser("SALES");
    const inactive = await makeUser("SALES", { isActive: false });

    for (const taken of [existing.email.toUpperCase(), ` ${inactive.email} `]) {
      const result = await actions.createUserAction({ name: "Dup", email: taken, role: "SALES" });
      expect(result).toMatchObject({ ok: false, fieldErrors: { email: expect.any(String) } });
      if (!result.ok) expect(result.error).toMatch(/already exists/);
    }
    // Legacy mixed-case row in the database is still matched.
    const legacy = `Legacy-${run}@Test.Local`;
    await prisma.user.create({ data: { name: "L", email: legacy, passwordHash } });
    const result = await actions.createUserAction({
      name: "Dup",
      email: legacy.toLowerCase(),
      role: "SALES",
    });
    expect(result).toMatchObject({ ok: false, fieldErrors: { email: expect.any(String) } });
  });
});

describe("edit user", () => {
  it("changes name and role and records before/after", async () => {
    const owner = await makeUser("OWNER");
    const target = await makeUser("SALES", { name: "Old Name" });
    actAs(owner);

    const result = await actions.updateUserAction({
      userId: target.id,
      name: "New Name",
      role: "MANAGER",
    });
    expect(result).toEqual({ ok: true });
    expect(await prisma.user.findUniqueOrThrow({ where: { id: target.id } })).toMatchObject({
      name: "New Name",
      role: "MANAGER",
    });
    const [audit] = await auditRows(target.id);
    expect(audit).toMatchObject({
      action: "UPDATE",
      before: { name: "Old Name", role: "SALES" },
      after: { name: "New Name", role: "MANAGER" },
    });
  });

  it("writes no audit row when nothing changed", async () => {
    const owner = await makeUser("OWNER");
    const target = await makeUser("VIEWER");
    actAs(owner);
    await actions.updateUserAction({ userId: target.id, name: target.name, role: "VIEWER" });
    expect(await auditRows(target.id)).toEqual([]);
  });

  it("you can't change your own role, but can change your own name", async () => {
    const owner = await makeUser("OWNER");
    actAs(owner);
    const demote = await actions.updateUserAction({
      userId: owner.id,
      name: owner.name,
      role: "MANAGER",
    });
    expect(demote).toMatchObject({
      ok: false,
      error: "You can't change your own role",
      fieldErrors: { role: expect.any(String) },
    });
    expect((await prisma.user.findUniqueOrThrow({ where: { id: owner.id } })).role).toBe("OWNER");

    const rename = await actions.updateUserAction({
      userId: owner.id,
      name: "Renamed Owner",
      role: "OWNER",
    });
    expect(rename).toEqual({ ok: true });
  });

  it("unknown user id gives a friendly error", async () => {
    actAs(await makeUser("OWNER"));
    expect(
      await actions.updateUserAction({ userId: "missing-id", name: "X", role: "SALES" }),
    ).toMatchObject({ ok: false, error: "That user no longer exists" });
    expect(await actions.deactivateUserAction({ userId: "missing-id" })).toMatchObject({
      ok: false,
    });
  });
});

describe("there is always at least one active Owner", () => {
  it("the only active Owner can't be demoted or deactivated (stale Owner session)", async () => {
    const lastOwner = await makeUser("OWNER");
    // Was an Owner a moment ago; their session (≤ 1 min old) still says OWNER.
    const formerOwner = await makeUser("MANAGER");
    actAs(formerOwner, "OWNER");

    await withOnlyOwners([lastOwner.id], async () => {
      const demote = await actions.updateUserAction({
        userId: lastOwner.id,
        name: lastOwner.name,
        role: "MANAGER",
      });
      expect(demote).toMatchObject({
        ok: false,
        error: expect.stringMatching(/only active Owner/),
      });
      const deactivate = await actions.deactivateUserAction({ userId: lastOwner.id });
      expect(deactivate).toMatchObject({
        ok: false,
        error: expect.stringMatching(/only active Owner/),
      });
    });
    expect(await prisma.user.findUniqueOrThrow({ where: { id: lastOwner.id } })).toMatchObject({
      role: "OWNER",
      isActive: true,
    });
    expect(await auditRows(lastOwner.id)).toEqual([]);
  });

  it("with two Owners one can be demoted or deactivated", async () => {
    const a = await makeUser("OWNER");
    const b = await makeUser("OWNER");
    const c = await makeUser("OWNER");
    actAs(a);
    await withOnlyOwners([a.id, b.id, c.id], async () => {
      expect(
        await actions.updateUserAction({ userId: b.id, name: b.name, role: "MANAGER" }),
      ).toEqual({ ok: true });
      expect(await actions.deactivateUserAction({ userId: c.id })).toEqual({ ok: true });
    });
  });

  it("two Owners demoting each other at the same time: exactly one succeeds", async () => {
    const a = await makeUser("OWNER");
    const b = await makeUser("OWNER");
    const { updateUser } = await import("@/server/users/manage-users");
    const { prisma: appPrisma } = await import("@/lib/db");

    await withOnlyOwners([a.id, b.id], async () => {
      const results = await Promise.allSettled([
        updateUser(appPrisma, { id: a.id }, { userId: b.id, name: b.name, role: "MANAGER" }),
        updateUser(appPrisma, { id: b.id }, { userId: a.id, name: a.name, role: "MANAGER" }),
      ]);
      expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
      const rejected = results.find((r) => r.status === "rejected");
      expect(rejected?.reason).toMatchObject({ code: "LAST_OWNER" });

      const owners = await prisma.user.count({
        where: { id: { in: [a.id, b.id] }, role: "OWNER", isActive: true },
      });
      expect(owners).toBe(1);
    });
  });

  it("deactivated Owners don't count", async () => {
    const active = await makeUser("OWNER");
    await makeUser("OWNER", { isActive: false });
    const formerOwner = await makeUser("MANAGER");
    actAs(formerOwner, "OWNER");
    await withOnlyOwners([active.id], async () => {
      expect(await actions.deactivateUserAction({ userId: active.id })).toMatchObject({
        ok: false,
        error: expect.stringMatching(/only active Owner/),
      });
    });
  });
});

describe("deactivate / reactivate", () => {
  it("you can't deactivate yourself", async () => {
    const owner = await makeUser("OWNER");
    actAs(owner);
    expect(await actions.deactivateUserAction({ userId: owner.id })).toMatchObject({
      ok: false,
      error: "You can't deactivate your own account",
    });
    expect((await prisma.user.findUniqueOrThrow({ where: { id: owner.id } })).isActive).toBe(true);
  });

  it("deactivation blocks sign-in and ends the session at its next re-check", async () => {
    const owner = await makeUser("OWNER");
    const target = await makeUser("SALES");
    actAs(owner);

    const token: JWT = {
      id: target.id,
      name: target.name,
      email: target.email,
      role: "SALES",
      mustChangePassword: false,
      checkedAt: Date.now(),
    };
    expect(await actions.deactivateUserAction({ userId: target.id })).toEqual({ ok: true });

    // Within the minute the token is still accepted; once the re-check is due it ends.
    expect(await refreshSessionToken(prisma, token)).toBe(token);
    expect(
      await refreshSessionToken(prisma, token, { now: Date.now() + USER_RECHECK_MS + 1 }),
    ).toBeNull();
    expect(
      await authenticate(prisma, {
        email: target.email,
        password: "Known-Password-1",
        ipAddress: `198.51.100.${run.length}`,
      }),
    ).toMatchObject({ ok: false, reason: "INACTIVE" });

    const [audit] = await auditRows(target.id);
    expect(audit).toMatchObject({
      action: "DEACTIVATE",
      before: { isActive: true },
      after: { isActive: false },
    });

    // Reactivate: can sign in again with the same password.
    expect(await actions.reactivateUserAction({ userId: target.id })).toEqual({ ok: true });
    expect((await auditRows(target.id)).at(-1)).toMatchObject({
      action: "RESTORE",
      after: { isActive: true },
    });
    expect(
      await authenticate(prisma, {
        email: target.email,
        password: "Known-Password-1",
        ipAddress: `198.51.100.${run.length + 1}`,
      }),
    ).toMatchObject({ ok: true });
  });
});

describe("reset password", () => {
  it("issues a new temporary password, forces a change, audit has no secrets", async () => {
    const owner = await makeUser("OWNER");
    const target = await makeUser("MANAGER");
    actAs(owner);

    const result = await actions.resetPasswordAction({ userId: target.id });
    if (!result.ok) throw new Error(result.error);
    expect(result.temporaryPassword).toMatch(TEMPORARY_PASSWORD_PATTERN);

    const user = await prisma.user.findUniqueOrThrow({ where: { id: target.id } });
    expect(user.mustChangePassword).toBe(true);
    expect(await verifyPassword(result.temporaryPassword, user.passwordHash)).toBe(true);
    expect(await verifyPassword("Known-Password-1", user.passwordHash)).toBe(false);

    // An open session is sent to /set-password at its next re-check.
    const token: JWT = {
      id: target.id,
      name: target.name,
      email: target.email,
      role: "MANAGER",
      mustChangePassword: false,
      checkedAt: 0,
    };
    expect(await refreshSessionToken(prisma, token)).toMatchObject({ mustChangePassword: true });

    const [audit] = await auditRows(target.id);
    expect(audit).toMatchObject({ action: "PASSWORD_RESET", userId: owner.id });
    expectNoSecrets([audit!.before, audit!.after], result.temporaryPassword);
  });

  it("you can't reset your own password here", async () => {
    const owner = await makeUser("OWNER");
    actAs(owner);
    expect(await actions.resetPasswordAction({ userId: owner.id })).toMatchObject({
      ok: false,
      error: expect.stringMatching(/Change password/),
    });
  });
});
