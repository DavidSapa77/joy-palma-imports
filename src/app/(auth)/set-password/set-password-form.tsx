"use client";

import { LoaderCircle } from "lucide-react";
import { useActionState, useState, type FormEvent } from "react";

import { PasswordInput } from "@/components/auth/password-input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { NEW_PASSWORD_MIN_LENGTH, setPasswordSchema } from "@/lib/validators/auth";
import { setPasswordAction, type SetPasswordState } from "@/server/actions/auth";

export function SetPasswordForm() {
  const [state, formAction, pending] = useActionState<SetPasswordState, FormData>(
    setPasswordAction,
    {},
  );
  // Length/match problems are caught here before submitting, so the typed
  // passwords are kept (the server checks everything again).
  const [clientErrors, setClientErrors] = useState<SetPasswordState["fieldErrors"]>();
  const errors = clientErrors ?? state.fieldErrors ?? {};

  function validateBeforeSubmit(event: FormEvent<HTMLFormElement>) {
    const data = new FormData(event.currentTarget);
    const parsed = setPasswordSchema.safeParse({
      newPassword: data.get("newPassword"),
      confirmPassword: data.get("confirmPassword"),
    });
    if (parsed.success) {
      setClientErrors(undefined);
      return;
    }
    event.preventDefault();
    const found: NonNullable<SetPasswordState["fieldErrors"]> = {};
    for (const issue of parsed.error.issues) {
      const field = issue.path[0];
      if ((field === "newPassword" || field === "confirmPassword") && !found[field]) {
        found[field] = issue.message;
      }
    }
    setClientErrors(found);
  }

  return (
    <form
      action={formAction}
      onSubmit={validateBeforeSubmit}
      noValidate
      className="flex flex-col gap-4"
    >
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="newPassword">New password</Label>
        <PasswordInput
          id="newPassword"
          name="newPassword"
          autoComplete="new-password"
          required
          minLength={NEW_PASSWORD_MIN_LENGTH}
          autoFocus
          aria-invalid={errors.newPassword ? true : undefined}
          aria-describedby="newPassword-hint"
        />
        <p
          id="newPassword-hint"
          className={errors.newPassword ? "text-sm text-danger" : "text-xs text-muted-foreground"}
        >
          {errors.newPassword ?? `At least ${NEW_PASSWORD_MIN_LENGTH} characters.`}
        </p>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="confirmPassword">Confirm new password</Label>
        <PasswordInput
          id="confirmPassword"
          name="confirmPassword"
          autoComplete="new-password"
          required
          aria-invalid={errors.confirmPassword ? true : undefined}
          aria-describedby={errors.confirmPassword ? "confirmPassword-error" : undefined}
        />
        {errors.confirmPassword && (
          <p id="confirmPassword-error" className="text-sm text-danger">
            {errors.confirmPassword}
          </p>
        )}
      </div>

      <Button type="submit" size="lg" className="mt-2 w-full sm:h-10" disabled={pending}>
        {pending && <LoaderCircle className="animate-spin" aria-hidden="true" />}
        {pending ? "Saving…" : "Save new password"}
      </Button>
    </form>
  );
}
