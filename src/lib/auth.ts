import NextAuth, { CredentialsSignin } from "next-auth";
import Credentials from "next-auth/providers/credentials";

import { authConfig } from "@/lib/auth.config";
import { prisma } from "@/lib/db";
import { loginSchema } from "@/lib/validators/auth";
import { authenticate } from "@/server/auth/authenticate";
import { refreshSessionToken } from "@/server/auth/refresh-token";

/** Error codes surfaced to the login form (`AuthError.code`). */
export class RateLimitedError extends CredentialsSignin {
  override code = "rate_limited";
}
export class InactiveUserError extends CredentialsSignin {
  override code = "inactive";
}

/** Client IP from the proxy headers (Vercel sets x-forwarded-for). */
export function clientIp(headers: Headers): string {
  const forwarded = headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || headers.get("x-real-ip")?.trim() || "unknown";
}

export const { handlers, auth, signIn, signOut, unstable_update } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      credentials: { email: {}, password: {} },
      async authorize(credentials, request) {
        const parsed = loginSchema.safeParse(credentials);
        if (!parsed.success) return null; // → generic "Email or password is incorrect"

        const result = await authenticate(prisma, {
          ...parsed.data,
          ipAddress: clientIp(request.headers),
        });
        if (result.ok) return result.user;
        if (result.reason === "RATE_LIMITED") throw new RateLimitedError();
        if (result.reason === "INACTIVE") throw new InactiveUserError();
        return null;
      },
    }),
  ],
  callbacks: {
    ...authConfig.callbacks,
    /**
     * Node-only jwt callback: on sign-in copy the user in; afterwards re-read
     * the user at most once a minute (and on `update()`), so deactivation,
     * role changes and password changes take effect without a new login.
     */
    async jwt(params) {
      const token = await authConfig.callbacks.jwt(params);
      if (params.user) return token;
      return refreshSessionToken(prisma, token, { force: params.trigger === "update" });
    },
  },
});
