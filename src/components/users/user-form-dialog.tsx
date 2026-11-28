"use client";

import type { Role } from "@prisma/client";
import { LoaderCircle } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { FormAlert } from "@/components/auth/form-alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ROLE_LABELS, ROLES } from "@/lib/permissions";
import type { UserRow } from "@/server/queries/users";
import { createUserAction, updateUserAction } from "@/server/actions/users";

import type { TemporaryPasswordInfo } from "./temporary-password-dialog";

const ROLE_HINTS: Record<Role, string> = {
  OWNER: "Full access, including users and settings",
  MANAGER: "Products, stock, sales and reports",
  SALES: "Records sales and customer requests",
  VIEWER: "Read-only reports and records",
};

export type UserFormMode = { mode: "create" } | { mode: "edit"; user: UserRow };

/** Add user (name, email, role) or edit name and role (UI spec §4.14). */
export function UserFormDialog({
  state,
  currentUserId,
  onClose,
  onCreated,
}: {
  state: UserFormMode | null;
  currentUserId: string;
  onClose: () => void;
  onCreated: (info: TemporaryPasswordInfo) => void;
}) {
  return (
    <Dialog open={state !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        {state && (
          <UserForm
            // Remount per user so the fields start from that user's values.
            key={state.mode === "edit" ? state.user.id : "create"}
            state={state}
            currentUserId={currentUserId}
            onClose={onClose}
            onCreated={onCreated}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function UserForm({
  state,
  currentUserId,
  onClose,
  onCreated,
}: {
  state: UserFormMode;
  currentUserId: string;
  onClose: () => void;
  onCreated: (info: TemporaryPasswordInfo) => void;
}) {
  const editing = state.mode === "edit" ? state.user : null;
  const isSelf = editing?.id === currentUserId;
  const [name, setName] = useState(editing?.name ?? "");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Role>(editing?.role ?? "SALES");
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<string, string>>>({});
  const [pending, startTransition] = useTransition();

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    startTransition(async () => {
      if (editing) {
        const result = await updateUserAction({ userId: editing.id, name, role });
        if (!result.ok) {
          setError(result.error);
          setFieldErrors(result.fieldErrors ?? {});
          return;
        }
        toast.success("User updated");
        onClose();
      } else {
        const result = await createUserAction({ name, email, role });
        if (!result.ok) {
          setError(result.error);
          setFieldErrors(result.fieldErrors ?? {});
          return;
        }
        onClose();
        onCreated({
          reason: "created",
          name: result.name,
          email: result.email,
          password: result.temporaryPassword,
        });
      }
    });
  }

  const fieldError = (field: string) =>
    fieldErrors[field] ? (
      <p id={`${field}-error`} className="text-sm text-danger">
        {fieldErrors[field]}
      </p>
    ) : null;

  return (
    <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
      <DialogHeader>
        <DialogTitle>{editing ? "Edit user" : "Add user"}</DialogTitle>
        <DialogDescription>
          {editing
            ? editing.email
            : "They'll get a temporary password and choose their own at first sign-in."}
        </DialogDescription>
      </DialogHeader>

      {error && !Object.keys(fieldErrors).length && <FormAlert>{error}</FormAlert>}

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="user-name">Name</Label>
        <Input
          id="user-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoComplete="off"
          maxLength={100}
          required
          aria-invalid={!!fieldErrors.name}
          aria-describedby={fieldErrors.name ? "name-error" : undefined}
        />
        {fieldError("name")}
      </div>

      {!editing && (
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="user-email">Email</Label>
          <Input
            id="user-email"
            type="email"
            inputMode="email"
            autoComplete="off"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            maxLength={254}
            required
            aria-invalid={!!fieldErrors.email}
            aria-describedby={fieldErrors.email ? "email-error" : undefined}
          />
          {fieldError("email")}
        </div>
      )}

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="user-role">Role</Label>
        <Select value={role} onValueChange={(v) => setRole(v as Role)} disabled={isSelf}>
          <SelectTrigger
            id="user-role"
            className="w-full"
            aria-invalid={!!fieldErrors.role}
            aria-describedby={fieldErrors.role ? "role-error" : "role-hint"}
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {ROLES.map((r) => (
              <SelectItem key={r} value={r}>
                {ROLE_LABELS[r]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p id="role-hint" className="text-xs text-muted-foreground">
          {isSelf ? "You can't change your own role." : ROLE_HINTS[role]}
        </p>
        {fieldError("role")}
      </div>

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onClose} disabled={pending}>
          Cancel
        </Button>
        <Button type="submit" disabled={pending}>
          {pending && <LoaderCircle className="animate-spin" aria-hidden="true" />}
          {editing ? "Save changes" : "Add user"}
        </Button>
      </DialogFooter>
    </form>
  );
}
