import type { Session } from "next-auth";
import { redirect } from "next/navigation";

import { auth } from "@/lib/auth";
import { LOGIN_PATH, SET_PASSWORD_PATH } from "@/lib/auth.config";

/**
 * For server components and actions: the current session, or a redirect to
 * /login. Users who must change their password are sent to /set-password.
 *
 * Middleware does the same for normal navigation, but pages rendered straight
 * from a server-action redirect skip middleware, so pages check too.
 */
export async function requireSession(): Promise<Session> {
  const session = await auth();
  if (!session) redirect(LOGIN_PATH);
  if (session.user.mustChangePassword) redirect(SET_PASSWORD_PATH);
  return session;
}
