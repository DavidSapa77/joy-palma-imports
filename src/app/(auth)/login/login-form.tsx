"use client";

import { LoaderCircle } from "lucide-react";
import { useActionState } from "react";

import { FormAlert } from "@/components/auth/form-alert";
import { PasswordInput } from "@/components/auth/password-input";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { loginAction, type LoginErrorCode, type LoginState } from "@/server/actions/auth";

const MESSAGES: Record<LoginErrorCode, string> = {
  invalid: "Email or password is incorrect",
  rate_limited: "Too many attempts, try again in 15 minutes.",
  inactive: "This account has been deactivated. Please ask the owner to reactivate it.",
};

export function LoginForm({ callbackUrl }: { callbackUrl: string }) {
  const [state, formAction, pending] = useActionState<LoginState, FormData>(loginAction, {
    email: "",
  });
  const invalid = state.error === "invalid";

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <input type="hidden" name="callbackUrl" value={callbackUrl} />

      {state.error && <FormAlert>{MESSAGES[state.error]}</FormAlert>}

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="username"
          inputMode="email"
          required
          autoFocus
          defaultValue={state.email}
          aria-invalid={invalid || undefined}
          className="sm:h-10"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="password">Password</Label>
        <PasswordInput
          id="password"
          name="password"
          autoComplete="current-password"
          required
          aria-invalid={invalid || undefined}
        />
      </div>

      <Button type="submit" size="lg" className="mt-2 w-full sm:h-10" disabled={pending}>
        {pending && <LoaderCircle className="animate-spin" aria-hidden="true" />}
        {pending ? "Signing in…" : "Sign in"}
      </Button>
    </form>
  );
}
