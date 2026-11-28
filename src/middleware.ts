import NextAuth from "next-auth";

import { authConfig } from "@/lib/auth.config";

/**
 * Route protection (edge runtime, no database). Signed-out users are sent to
 * /login; users who must change their password are sent to /set-password;
 * roles without access to a page (lib/routes.ts) get the 403 page. See the
 * `authorized` callback in lib/auth.config.ts.
 */
export const { auth: middleware } = NextAuth(authConfig);

export const config = {
  // Everything except Auth.js endpoints, Next.js internals and static files.
  matcher: [
    "/((?!api/auth|_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|svg|webp|ico|txt)$).*)",
  ],
};
