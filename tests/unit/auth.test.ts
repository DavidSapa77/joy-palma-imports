import type { Session } from "next-auth";
import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";

import { redactSecrets, REDACTED } from "@/lib/audit";
import { authConfig, SESSION_MAX_AGE_SECONDS } from "@/lib/auth.config";
import { loginSchema, safeCallbackUrl, setPasswordSchema } from "@/lib/validators/auth";

describe("loginSchema", () => {
  it("lower-cases and trims the email", () => {
    expect(loginSchema.parse({ email: "  Joy@Example.COM ", password: "x" })).toEqual({
      email: "joy@example.com",
      password: "x",
    });
  });

  it("rejects empty or malformed input", () => {
    expect(loginSchema.safeParse({ email: "not-an-email", password: "x" }).success).toBe(false);
    expect(loginSchema.safeParse({ email: "joy@example.com", password: "" }).success).toBe(false);
    expect(loginSchema.safeParse({}).success).toBe(false);
  });
});

describe("setPasswordSchema", () => {
  const parse = (newPassword: string, confirmPassword = newPassword) =>
    setPasswordSchema.safeParse({ newPassword, confirmPassword });

  it("needs at least 10 characters", () => {
    expect(parse("123456789").success).toBe(false);
    expect(parse("1234567890").success).toBe(true);
  });

  it("needs a matching confirmation", () => {
    const result = parse("1234567890", "1234567899");
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.path).toEqual(["confirmPassword"]);
  });

  it("caps the length", () => {
    expect(parse("x".repeat(129)).success).toBe(false);
  });
});

describe("safeCallbackUrl", () => {
  it.each([
    ["/sales", "/sales"],
    ["/sales/new?x=1#top", "/sales/new?x=1#top"],
    ["http://localhost:3000/products?q=a", "/products?q=a"], // middleware sends absolute URLs
    ["https://evil.example/phish", "/phish"], // origin dropped: stays on our site
  ])("%s → %s", (input, expected) => {
    expect(safeCallbackUrl(input)).toBe(expected);
  });

  it.each([
    undefined,
    "",
    "sales",
    "//evil.example",
    "/\\evil.example",
    "javascript:alert(1)",
    "/login",
    "/login?callbackUrl=/x",
    "/api/auth/signout",
    "/ok\r\nSet-Cookie: x",
    42,
  ])("rejects %j", (input) => {
    expect(safeCallbackUrl(input)).toBe("/");
  });

  it("takes the first of repeated query values", () => {
    expect(safeCallbackUrl(["/a", "/b"])).toBe("/a");
  });
});

describe("redactSecrets", () => {
  it("redacts secret-looking keys at any depth", () => {
    expect(
      redactSecrets({
        email: "a@b.c",
        password: "p",
        passwordHash: "h",
        newPassword: "n",
        nested: { authToken: "t", apiSecret: "s", ok: 1 },
        list: [{ confirmPassword: "c" }],
        passwordChanged: true,
        mustChangePassword: true,
      }),
    ).toEqual({
      email: "a@b.c",
      password: REDACTED,
      passwordHash: REDACTED,
      newPassword: REDACTED,
      nested: { authToken: REDACTED, apiSecret: REDACTED, ok: 1 },
      list: [{ confirmPassword: REDACTED }],
      passwordChanged: true,
      mustChangePassword: true,
    });
  });
});

describe("session settings", () => {
  it("expires after 12 hours of inactivity (PRD F1)", () => {
    expect(SESSION_MAX_AGE_SECONDS).toBe(43_200);
    expect(authConfig.session).toEqual({ strategy: "jwt", maxAge: 43_200 });
  });
});

describe("route protection (authorized callback)", () => {
  const user = (mustChangePassword: boolean): Session => ({
    expires: new Date(Date.now() + 3_600_000).toISOString(),
    user: { id: "u1", name: "Ama", email: "a@b.c", role: "SALES", mustChangePassword },
  });
  const check = (path: string, session: Session | null) =>
    authConfig.callbacks.authorized({
      auth: session,
      request: new NextRequest(new URL(path, "http://localhost:3000")),
    });
  const location = (result: ReturnType<typeof check>) =>
    result instanceof Response ? new URL(result.headers.get("location")!).pathname : result;

  it("sends signed-out users to the login page", () => {
    expect(check("/", null)).toBe(false);
    expect(check("/set-password", null)).toBe(false);
    expect(check("/login", null)).toBe(true);
  });

  it("forces users who must change their password to /set-password", () => {
    expect(location(check("/", user(true)))).toBe("/set-password");
    expect(location(check("/sales", user(true)))).toBe("/set-password");
    expect(location(check("/login", user(true)))).toBe("/set-password");
    expect(check("/set-password", user(true))).toBe(true);
  });

  it("lets signed-in users through and away from /login", () => {
    expect(check("/", user(false))).toBe(true);
    expect(location(check("/login", user(false)))).toBe("/");
  });
});
