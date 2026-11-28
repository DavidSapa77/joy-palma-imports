import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const { generateTemporaryPassword, TEMPORARY_PASSWORD_PATTERN } =
  await import("@/lib/temporary-password");

describe("generateTemporaryPassword", () => {
  const samples = Array.from({ length: 500 }, generateTemporaryPassword);

  it("has the xxxx-xxxx-xxxx shape and passes the new-password rules (≥ 10 chars)", () => {
    for (const p of samples) {
      expect(p).toMatch(TEMPORARY_PASSWORD_PATTERN);
      expect(p.length).toBe(14);
    }
  });

  it("always mixes upper case, lower case and digits, without look-alike characters", () => {
    for (const p of samples) {
      expect(p).toMatch(/[A-Z]/);
      expect(p).toMatch(/[a-z]/);
      expect(p).toMatch(/[0-9]/);
      expect(p).not.toMatch(/[0O1lI]/);
    }
  });

  it("doesn't repeat", () => {
    expect(new Set(samples).size).toBe(samples.length);
  });
});
