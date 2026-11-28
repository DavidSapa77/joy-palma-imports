"use server";

import { AuthError, CredentialsSignin } from "next-auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { auth, clientIp, signIn, signOut, unstable_update } from "@/lib/auth";
import { LOGIN_PATH, SET_PASSWORD_PATH } from "@/lib/auth.config";
import { prisma } from "@/lib/db";
import { HOME_PATH } from "@/lib/routes";
import { safeCallbackUrl } from "@/lib/validators/auth";
import { changeOwnPassword } from "@/server/auth/change-password";

export type LoginErrorCode = "invalid" | "rate_limited" | "inactive";
export type LoginState = { email: string; error?: LoginErrorCode };

/**
 * Login form action. Credentials are checked by the Auth.js Credentials
 * provider (lib/auth.ts → server/auth/authenticate.ts), which also handles
 * the rate limit and the LOGIN / LOGIN_FAILED audit rows.
 */
export async function loginAction(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  // "/" only redirects to the dashboard, and a server action can't follow a
  // second redirect, so go there directly.
  const callbackUrl = safeCallbackUrl(formData.get("callbackUrl"), HOME_PATH);
  const redirectTo = callbackUrl === "/" ? HOME_PATH : callbackUrl;

  try {
    await signIn("credentials", { email, password, redirect: false });
  } catch (error) {
    if (error instanceof AuthError) {
      const code = error instanceof CredentialsSignin ? error.code : undefined;
      if (code === "rate_limited") return { email, error: "rate_limited" };
      if (code === "inactive") return { email, error: "inactive" };
      return { email, error: "invalid" };
    }
    throw error;
  }

  // Signed in. Pages rendered from an action redirect skip middleware, so pick
  // the destination here: forced password change first.
  const user = await prisma.user.findUnique({
    where: { email: email.toLowerCase() },
    select: { mustChangePassword: true },
  });
  redirect(user?.mustChangePassword ? SET_PASSWORD_PATH : redirectTo);
}

export type SetPasswordState = {
  fieldErrors?: Partial<Record<"newPassword" | "confirmPassword", string>>;
};

/** Signed-in user sets a new password (forced when mustChangePassword). */
export async function setPasswordAction(
  _prev: SetPasswordState,
  formData: FormData,
): Promise<SetPasswordState> {
  // Every signed-in user may change their own password, so there is no extra permission check.
  const session = await auth();
  if (!session) redirect(LOGIN_PATH);

  const result = await changeOwnPassword(prisma, {
    userId: session.user.id,
    newPassword: String(formData.get("newPassword") ?? ""),
    confirmPassword: String(formData.get("confirmPassword") ?? ""),
    ipAddress: clientIp(await headers()),
  });
  if (!result.ok) return { fieldErrors: result.fieldErrors };

  // Re-read the user into the session (mustChangePassword is now false).
  await unstable_update({});
  redirect(HOME_PATH);
}

export async function signOutAction(): Promise<void> {
  await signOut({ redirectTo: LOGIN_PATH });
}
