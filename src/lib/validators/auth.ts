import { z } from "zod";

/** New passwords (set-password screen, later: user admin). */
export const NEW_PASSWORD_MIN_LENGTH = 10;
export const PASSWORD_MAX_LENGTH = 128; // bcrypt only uses the first 72 bytes; this caps abuse

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().pipe(z.email()),
  password: z.string().min(1).max(PASSWORD_MAX_LENGTH),
});

export type LoginInput = z.infer<typeof loginSchema>;

export const setPasswordSchema = z
  .object({
    newPassword: z
      .string()
      .min(NEW_PASSWORD_MIN_LENGTH, `Use at least ${NEW_PASSWORD_MIN_LENGTH} characters`)
      .max(PASSWORD_MAX_LENGTH, `Use at most ${PASSWORD_MAX_LENGTH} characters`),
    confirmPassword: z.string(),
  })
  .refine((v) => v.newPassword === v.confirmPassword, {
    path: ["confirmPassword"],
    message: "The passwords don't match",
  });

export type SetPasswordInput = z.infer<typeof setPasswordSchema>;

/**
 * Only same-site relative paths are allowed as post-login redirects
 * ("/sales", not "https://evil.example" or "//evil.example").
 */
export function safeCallbackUrl(value: unknown, fallback = "/"): string {
  let path = Array.isArray(value) ? value[0] : value;
  if (typeof path !== "string" || path === "") return fallback;

  // Middleware passes absolute URLs; keep only the path so we always stay on this site.
  if (/^https?:\/\//i.test(path)) {
    try {
      const url = new URL(path);
      path = url.pathname + url.search + url.hash;
    } catch {
      return fallback;
    }
  }

  if (!path.startsWith("/") || path.startsWith("//") || path.startsWith("/\\")) return fallback;
  if (/[\r\n]/.test(path)) return fallback;
  if (path === "/login" || path.startsWith("/login?") || path.startsWith("/api/auth")) {
    return fallback;
  }
  return path;
}
