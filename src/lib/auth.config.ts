import type { NextAuthConfig } from "next-auth";
import { NextResponse } from "next/server";

import { canAccessPath, FORBIDDEN_PATH, HOME_PATH } from "@/lib/routes";

/**
 * Edge-safe Auth.js config (no Prisma, no bcrypt), shared by middleware.ts and
 * lib/auth.ts. Database-backed pieces (the Credentials provider and the
 * user re-check in the jwt callback) are added in lib/auth.ts.
 */

/** PRD F1: sessions expire after 12 hours of inactivity. */
export const SESSION_MAX_AGE_SECONDS = 12 * 60 * 60;

export const LOGIN_PATH = "/login";
export const SET_PASSWORD_PATH = "/set-password";

export const authConfig = {
  pages: { signIn: LOGIN_PATH },
  // JWT sessions are re-issued with a fresh expiry whenever they're used, so
  // maxAge works as an inactivity timeout.
  session: { strategy: "jwt", maxAge: SESSION_MAX_AGE_SECONDS },
  trustHost: true,
  providers: [],
  callbacks: {
    /**
     * Route protection, run by middleware.ts: signed-out → /login, pending
     * password change → /set-password, role without access → the 403 page
     * (rewritten, so the address bar keeps the requested URL). Pages repeat
     * the role check with guardRoute(), because the JWT role can be up to a
     * minute stale and pages rendered from a server-action redirect skip
     * middleware.
     */
    authorized({ auth, request }) {
      const { pathname } = request.nextUrl;
      const user = auth?.user;

      if (pathname === LOGIN_PATH) {
        if (!user) return true;
        const target = user.mustChangePassword ? SET_PASSWORD_PATH : HOME_PATH;
        return Response.redirect(new URL(target, request.nextUrl));
      }
      if (!user) return false; // → /login?callbackUrl=…

      if (user.mustChangePassword && pathname !== SET_PASSWORD_PATH) {
        return Response.redirect(new URL(SET_PASSWORD_PATH, request.nextUrl));
      }
      if (!canAccessPath(user.role, pathname)) {
        return NextResponse.rewrite(new URL(FORBIDDEN_PATH, request.nextUrl));
      }
      return true;
    },

    jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.name = user.name;
        token.email = user.email;
        token.role = user.role;
        token.mustChangePassword = user.mustChangePassword;
        token.checkedAt = Date.now();
      }
      return token;
    },

    session({ session, token }) {
      session.user.id = token.id;
      session.user.name = token.name;
      session.user.email = token.email;
      session.user.role = token.role;
      session.user.mustChangePassword = token.mustChangePassword;
      return session;
    },
  },
} satisfies NextAuthConfig;
