import { randomUUID } from "node:crypto";

import { PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { REDACTED } from "@/lib/audit";
import { hashPassword } from "@/lib/password";
import { authenticate, LOGIN_WINDOW_MS } from "@/server/auth/authenticate";
import { changeOwnPassword } from "@/server/auth/change-password";

import { getTestDatabaseUrl } from "./test-env";

let prisma: PrismaClient;
let passwordHash: string;
const PASSWORD = "Correct-Horse-42";
const run = randomUUID().slice(0, 8);

/** Unique email + IP per test, so rate-limit counters never interfere. */
const fresh = () => {
  const id = randomUUID().slice(0, 8);
  return { email: `user-${run}-${id}@test.local`, ip: `10.${run.length}.0.${id}` };
};

async function createUser(email: string, overrides: { isActive?: boolean } = {}) {
  return prisma.user.create({
    data: { name: "Ama Test", email, passwordHash, role: "SALES", ...overrides },
  });
}

const auditFor = (where: { userId?: string | null; ipAddress?: string }) =>
  prisma.auditLog.findMany({ where, orderBy: { createdAt: "asc" } });

beforeAll(async () => {
  prisma = new PrismaClient({ datasourceUrl: getTestDatabaseUrl() });
  passwordHash = await hashPassword(PASSWORD);
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe("authenticate", () => {
  it("accepts the correct email and password", async () => {
    const { email, ip } = fresh();
    const user = await createUser(email);
    const result = await authenticate(prisma, { email, password: PASSWORD, ipAddress: ip });

    expect(result).toEqual({
      ok: true,
      user: { id: user.id, name: "Ama Test", email, role: "SALES", mustChangePassword: true },
    });
    const updated = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(updated.lastLoginAt).toBeInstanceOf(Date);
  });

  it("compares the email case-insensitively and ignores surrounding spaces", async () => {
    const { email, ip } = fresh();
    await createUser(email);
    const result = await authenticate(prisma, {
      email: `  ${email.toUpperCase()} `,
      password: PASSWORD,
      ipAddress: ip,
    });
    expect(result.ok).toBe(true);
  });

  it("rejects a wrong password", async () => {
    const { email, ip } = fresh();
    const user = await createUser(email);
    const result = await authenticate(prisma, { email, password: "wrong", ipAddress: ip });
    expect(result).toEqual({ ok: false, reason: "INVALID_CREDENTIALS" });
    const updated = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(updated.lastLoginAt).toBeNull();
  });

  it("gives an unknown email exactly the same result as a wrong password", async () => {
    const known = fresh();
    await createUser(known.email);
    const wrongPassword = await authenticate(prisma, {
      email: known.email,
      password: "wrong",
      ipAddress: known.ip,
    });
    const unknown = fresh();
    const unknownEmail = await authenticate(prisma, {
      email: unknown.email,
      password: PASSWORD,
      ipAddress: unknown.ip,
    });
    expect(unknownEmail).toEqual(wrongPassword);
    expect(unknownEmail).toEqual({ ok: false, reason: "INVALID_CREDENTIALS" });
  });

  it("rejects an inactive user, even with the right password", async () => {
    const { email, ip } = fresh();
    const user = await createUser(email, { isActive: false });
    expect(await authenticate(prisma, { email, password: PASSWORD, ipAddress: ip })).toEqual({
      ok: false,
      reason: "INACTIVE",
    });
    // With a wrong password it gives no hint that the account exists.
    expect(await authenticate(prisma, { email, password: "nope", ipAddress: ip })).toEqual({
      ok: false,
      reason: "INVALID_CREDENTIALS",
    });
    const updated = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(updated.lastLoginAt).toBeNull();
  });
});

describe("rate limiting (5 failures per email + IP per 15 minutes)", () => {
  it("kicks in on the 6th attempt, even with the right password", async () => {
    const { email, ip } = fresh();
    await createUser(email);
    const t0 = new Date("2026-11-26T10:00:00Z");
    for (let i = 0; i < 5; i++) {
      const result = await authenticate(prisma, {
        email,
        password: "wrong",
        ipAddress: ip,
        now: new Date(t0.getTime() + i * 60_000),
      });
      expect(result).toEqual({ ok: false, reason: "INVALID_CREDENTIALS" });
    }
    const sixth = await authenticate(prisma, {
      email,
      password: PASSWORD,
      ipAddress: ip,
      now: new Date(t0.getTime() + 5 * 60_000),
    });
    expect(sixth).toEqual({
      ok: false,
      reason: "RATE_LIMITED",
      retryAt: new Date(t0.getTime() + LOGIN_WINDOW_MS),
    });
  });

  it("unlocks 15 minutes after the first of the 5 failures; blocked tries don't extend it", async () => {
    const { email, ip } = fresh();
    await createUser(email);
    const t0 = new Date("2026-11-26T11:00:00Z");
    const at = (ms: number) => new Date(t0.getTime() + ms);
    for (let i = 0; i < 5; i++) {
      await authenticate(prisma, { email, password: "wrong", ipAddress: ip, now: at(i * 1000) });
    }
    // Hammering while locked doesn't push the unlock time back.
    for (let i = 0; i < 3; i++) {
      const blocked = await authenticate(prisma, {
        email,
        password: PASSWORD,
        ipAddress: ip,
        now: at(10 * 60_000 + i * 1000),
      });
      expect(blocked.ok).toBe(false);
    }
    const stillLocked = await authenticate(prisma, {
      email,
      password: PASSWORD,
      ipAddress: ip,
      now: at(LOGIN_WINDOW_MS - 1),
    });
    expect(stillLocked).toMatchObject({ ok: false, reason: "RATE_LIMITED" });
    const unlocked = await authenticate(prisma, {
      email,
      password: PASSWORD,
      ipAddress: ip,
      now: at(LOGIN_WINDOW_MS + 1),
    });
    expect(unlocked.ok).toBe(true);
  });

  it("counts per email + IP: another IP is not blocked", async () => {
    const { email, ip } = fresh();
    await createUser(email);
    const now = new Date("2026-11-26T12:00:00Z");
    for (let i = 0; i < 5; i++) {
      await authenticate(prisma, { email, password: "wrong", ipAddress: ip, now });
    }
    expect(
      await authenticate(prisma, { email, password: PASSWORD, ipAddress: ip, now }),
    ).toMatchObject({
      reason: "RATE_LIMITED",
    });
    expect(
      (await authenticate(prisma, { email, password: PASSWORD, ipAddress: `${ip}-other`, now })).ok,
    ).toBe(true);
  });

  it("applies to unknown emails too", async () => {
    const { email, ip } = fresh();
    const now = new Date("2026-11-26T13:00:00Z");
    for (let i = 0; i < 5; i++) {
      await authenticate(prisma, { email, password: "x", ipAddress: ip, now });
    }
    expect(await authenticate(prisma, { email, password: "x", ipAddress: ip, now })).toMatchObject({
      reason: "RATE_LIMITED",
    });
  });

  it("a successful login resets the count", async () => {
    const { email, ip } = fresh();
    await createUser(email);
    const t0 = new Date("2026-11-26T14:00:00Z");
    const at = (s: number) => new Date(t0.getTime() + s * 1000);
    for (let i = 0; i < 4; i++) {
      await authenticate(prisma, { email, password: "wrong", ipAddress: ip, now: at(i) });
    }
    expect(
      (await authenticate(prisma, { email, password: PASSWORD, ipAddress: ip, now: at(10) })).ok,
    ).toBe(true);
    for (let i = 0; i < 4; i++) {
      await authenticate(prisma, { email, password: "wrong", ipAddress: ip, now: at(20 + i) });
    }
    expect(
      (await authenticate(prisma, { email, password: PASSWORD, ipAddress: ip, now: at(30) })).ok,
    ).toBe(true);
  });

  it("stores attempts in the database (survives a restart)", async () => {
    const { email, ip } = fresh();
    const now = new Date("2026-11-26T15:00:00Z");
    for (let i = 0; i < 5; i++) {
      await authenticate(prisma, { email, password: "x", ipAddress: ip, now });
    }
    // A brand-new client = a restarted server.
    const restarted = new PrismaClient({ datasourceUrl: getTestDatabaseUrl() });
    try {
      expect(
        await authenticate(restarted, { email, password: "x", ipAddress: ip, now }),
      ).toMatchObject({
        reason: "RATE_LIMITED",
      });
    } finally {
      await restarted.$disconnect();
    }
  });
});

describe("audit log", () => {
  it("writes LOGIN on success and LOGIN_FAILED (with reason) on failures", async () => {
    const { email, ip } = fresh();
    const user = await createUser(email);
    await authenticate(prisma, { email, password: "wrong", ipAddress: ip });
    await authenticate(prisma, { email, password: PASSWORD, ipAddress: ip });

    const rows = await auditFor({ ipAddress: ip });
    expect(rows.map((r) => r.action)).toEqual(["LOGIN_FAILED", "LOGIN"]);
    expect(rows[0]).toMatchObject({
      userId: user.id,
      entityType: "User",
      entityId: user.id,
      after: { email, reason: "WRONG_PASSWORD" },
    });
    expect(rows[1]).toMatchObject({ userId: user.id, entityType: "User", entityId: user.id });
  });

  it("records unknown-email, inactive and rate-limited failures", async () => {
    const unknown = fresh();
    await authenticate(prisma, { email: unknown.email, password: "x", ipAddress: unknown.ip });
    expect((await auditFor({ ipAddress: unknown.ip }))[0]).toMatchObject({
      action: "LOGIN_FAILED",
      userId: null,
      after: { email: unknown.email, reason: "UNKNOWN_EMAIL" },
    });

    const inactive = fresh();
    const user = await createUser(inactive.email, { isActive: false });
    await authenticate(prisma, {
      email: inactive.email,
      password: PASSWORD,
      ipAddress: inactive.ip,
    });
    expect((await auditFor({ ipAddress: inactive.ip }))[0]).toMatchObject({
      action: "LOGIN_FAILED",
      userId: user.id,
      after: { reason: "INACTIVE" },
    });

    const limited = fresh();
    const now = new Date("2026-11-26T16:00:00Z");
    for (let i = 0; i < 6; i++) {
      await authenticate(prisma, {
        email: limited.email,
        password: "x",
        ipAddress: limited.ip,
        now,
      });
    }
    const rows = await auditFor({ ipAddress: limited.ip });
    expect(rows).toHaveLength(6);
    expect(rows.at(-1)).toMatchObject({
      action: "LOGIN_FAILED",
      after: { reason: "RATE_LIMITED" },
    });
  });

  it("never stores the password", async () => {
    const { email, ip } = fresh();
    await createUser(email);
    await authenticate(prisma, { email, password: "my-secret-guess", ipAddress: ip });
    const rows = await auditFor({ ipAddress: ip });
    expect(JSON.stringify(rows)).not.toContain("my-secret-guess");
  });
});

describe("changeOwnPassword", () => {
  it("validates length, confirmation and reuse", async () => {
    const { email } = fresh();
    const user = await createUser(email);
    const change = (newPassword: string, confirmPassword = newPassword) =>
      changeOwnPassword(prisma, { userId: user.id, newPassword, confirmPassword });

    expect(await change("short")).toMatchObject({
      ok: false,
      fieldErrors: { newPassword: "Use at least 10 characters" },
    });
    expect(await change("long-enough-1", "long-enough-2")).toMatchObject({
      ok: false,
      fieldErrors: { confirmPassword: "The passwords don't match" },
    });
    expect(await change(PASSWORD)).toMatchObject({
      ok: false,
      fieldErrors: { newPassword: expect.stringMatching(/haven't used/) },
    });
    const unchanged = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(unchanged.passwordHash).toBe(passwordHash);
    expect(unchanged.mustChangePassword).toBe(true);
  });

  it("sets the new password, clears mustChangePassword and audits it", async () => {
    const { email, ip } = fresh();
    const user = await createUser(email);
    const result = await changeOwnPassword(prisma, {
      userId: user.id,
      newPassword: "A-brand-new-pass",
      confirmPassword: "A-brand-new-pass",
      ipAddress: ip,
    });
    expect(result).toEqual({ ok: true });

    const updated = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(updated.mustChangePassword).toBe(false);
    expect(updated.passwordHash).not.toBe(passwordHash);

    expect((await authenticate(prisma, { email, password: PASSWORD, ipAddress: ip })).ok).toBe(
      false,
    );
    expect(
      (await authenticate(prisma, { email, password: "A-brand-new-pass", ipAddress: ip })).ok,
    ).toBe(true);

    const audit = await prisma.auditLog.findFirstOrThrow({
      where: { entityId: user.id, action: "UPDATE" },
    });
    expect(audit).toMatchObject({
      userId: user.id,
      before: { mustChangePassword: true },
      after: { mustChangePassword: false, passwordChanged: true },
      ipAddress: ip,
    });
    expect(JSON.stringify(audit)).not.toContain("A-brand-new-pass");
    expect(JSON.stringify(audit)).not.toContain(REDACTED); // nothing secret was even passed in
  });
});
