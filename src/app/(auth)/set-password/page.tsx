import { KeyRound } from "lucide-react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { auth } from "@/lib/auth";
import { LOGIN_PATH } from "@/lib/auth.config";
import { signOutAction } from "@/server/actions/auth";

import { SetPasswordForm } from "./set-password-form";

export const metadata: Metadata = { title: "Set new password · Joy Palma Imports" };

export default async function SetPasswordPage() {
  const session = await auth();
  if (!session) redirect(LOGIN_PATH);
  const forced = session.user.mustChangePassword;

  return (
    <Card className="gap-6">
      <CardHeader className="justify-items-center gap-3 text-center">
        <div className="flex size-14 items-center justify-center rounded-xl bg-secondary text-primary">
          <KeyRound className="size-6" aria-hidden="true" />
        </div>
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold text-foreground">Set a new password</h1>
          <p className="text-sm text-muted-foreground">
            {forced
              ? `Hi ${session.user.name}, please choose a new password to continue.`
              : `Choose a new password for ${session.user.email}.`}
          </p>
        </div>
      </CardHeader>
      <CardContent>
        <SetPasswordForm />
      </CardContent>
      <CardFooter className="justify-center border-t py-3">
        <form action={signOutAction}>
          <Button type="submit" variant="link" className="text-muted-foreground">
            Not you? Sign out
          </Button>
        </form>
      </CardFooter>
    </Card>
  );
}
