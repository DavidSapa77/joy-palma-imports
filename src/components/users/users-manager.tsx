"use client";

import { Ellipsis, KeyRound, LoaderCircle, Pencil, UserCheck, UserPlus, UserX } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { FormAlert } from "@/components/auth/form-alert";
import { RoleBadge } from "@/components/layout/user-menu";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  deactivateUserAction,
  reactivateUserAction,
  resetPasswordAction,
} from "@/server/actions/users";
import type { UserRow } from "@/server/queries/users";

import { TemporaryPasswordDialog, type TemporaryPasswordInfo } from "./temporary-password-dialog";
import { UserFormDialog, type UserFormMode } from "./user-form-dialog";

type ConfirmKind = "reset" | "deactivate" | "reactivate";
type ConfirmState = { kind: ConfirmKind; user: UserRow };

/** Admin → Users (UI spec §4.14): table on desktop, cards on phones, dialogs for every action. */
export function UsersManager({
  users,
  currentUserId,
}: {
  users: UserRow[];
  currentUserId: string;
}) {
  const [form, setForm] = useState<UserFormMode | null>(null);
  const [confirm, setConfirm] = useState<ConfirmState | null>(null);
  const [password, setPassword] = useState<TemporaryPasswordInfo | null>(null);

  const actionsFor = (user: UserRow) => (
    <UserActions
      user={user}
      isSelf={user.id === currentUserId}
      onEdit={() => setForm({ mode: "edit", user })}
      onConfirm={(kind) => setConfirm({ kind, user })}
    />
  );
  const activeCount = users.filter((u) => u.isActive).length;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          {activeCount} active · {users.length - activeCount} deactivated
        </p>
        <Button onClick={() => setForm({ mode: "create" })}>
          <UserPlus aria-hidden="true" />
          Add user
        </Button>
      </div>

      {/* Desktop / tablet: table */}
      <Card className="hidden py-0 md:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="pl-4">Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Last login</TableHead>
              <TableHead className="w-12 pr-4">
                <span className="sr-only">Actions</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.map((user) => (
              <TableRow key={user.id} data-testid="user-row" data-email={user.email}>
                <TableCell className="pl-4 font-medium">
                  {user.name}
                  {user.id === currentUserId && (
                    <span className="ml-1 text-xs font-normal text-muted-foreground">(you)</span>
                  )}
                </TableCell>
                <TableCell className="text-muted-foreground">{user.email}</TableCell>
                <TableCell>
                  <RoleBadgeCell user={user} />
                </TableCell>
                <TableCell>
                  <StatusBadges user={user} />
                </TableCell>
                <TableCell className="text-muted-foreground tabular-nums">
                  {user.lastLogin ?? "Never"}
                </TableCell>
                <TableCell className="pr-4 text-right">{actionsFor(user)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      {/* Phones: cards */}
      <ul className="flex flex-col gap-3 md:hidden">
        {users.map((user) => (
          <li key={user.id} data-testid="user-card" data-email={user.email}>
            <Card className="gap-2 px-4 py-3">
              <div className="flex items-start gap-2">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">
                    {user.name}
                    {user.id === currentUserId && (
                      <span className="ml-1 text-xs font-normal text-muted-foreground">(you)</span>
                    )}
                  </p>
                  <p className="truncate text-sm text-muted-foreground">{user.email}</p>
                </div>
                {actionsFor(user)}
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                <RoleBadgeCell user={user} />
                <StatusBadges user={user} />
              </div>
              <p className="text-xs text-muted-foreground">
                Last login: {user.lastLogin ?? "Never"}
              </p>
            </Card>
          </li>
        ))}
      </ul>

      <UserFormDialog
        state={form}
        currentUserId={currentUserId}
        onClose={() => setForm(null)}
        onCreated={setPassword}
      />
      <ConfirmUserAction
        state={confirm}
        onClose={() => setConfirm(null)}
        onPassword={setPassword}
      />
      <TemporaryPasswordDialog info={password} onClose={() => setPassword(null)} />
    </div>
  );
}

function RoleBadgeCell({ user }: { user: UserRow }) {
  // RoleBadge carries a test id meant for the user menu; the table uses its own.
  return (
    <span data-testid="user-role">
      <RoleBadge role={user.role} />
    </span>
  );
}

function StatusBadges({ user }: { user: UserRow }) {
  return (
    <span className="inline-flex flex-wrap gap-1.5" data-testid="user-status">
      {user.isActive ? (
        <Badge variant="success">Active</Badge>
      ) : (
        <Badge variant="danger">Deactivated</Badge>
      )}
      {user.isActive && user.mustChangePassword && (
        <Badge variant="warning">Temporary password</Badge>
      )}
    </span>
  );
}

function UserActions({
  user,
  isSelf,
  onEdit,
  onConfirm,
}: {
  user: UserRow;
  isSelf: boolean;
  onEdit: () => void;
  onConfirm: (kind: ConfirmKind) => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label={`Actions for ${user.name}`}>
          <Ellipsis aria-hidden="true" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52">
        <DropdownMenuItem className="min-h-11 sm:min-h-9" onSelect={onEdit}>
          <Pencil aria-hidden="true" />
          Edit
        </DropdownMenuItem>
        {!isSelf && (
          <DropdownMenuItem className="min-h-11 sm:min-h-9" onSelect={() => onConfirm("reset")}>
            <KeyRound aria-hidden="true" />
            Reset password
          </DropdownMenuItem>
        )}
        {!isSelf && user.isActive && (
          <DropdownMenuItem
            variant="destructive"
            className="min-h-11 sm:min-h-9"
            onSelect={() => onConfirm("deactivate")}
          >
            <UserX aria-hidden="true" />
            Deactivate
          </DropdownMenuItem>
        )}
        {!user.isActive && (
          <DropdownMenuItem
            className="min-h-11 sm:min-h-9"
            onSelect={() => onConfirm("reactivate")}
          >
            <UserCheck aria-hidden="true" />
            Reactivate
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

const CONFIRM_COPY: Record<
  ConfirmKind,
  { title: string; body: (name: string) => string; button: string; done: string }
> = {
  reset: {
    title: "Reset password?",
    body: (name) =>
      `${name} gets a new temporary password (shown once) and must choose their own at next sign-in. Their current password stops working.`,
    button: "Reset password",
    done: "Password reset",
  },
  deactivate: {
    title: "Deactivate user?",
    body: (name) =>
      `${name} won't be able to sign in, and will be signed out within a minute. Their sales and history are kept. You can reactivate them later.`,
    button: "Deactivate",
    done: "User deactivated",
  },
  reactivate: {
    title: "Reactivate user?",
    body: (name) => `${name} will be able to sign in again with their current password.`,
    button: "Reactivate",
    done: "User reactivated",
  },
};

function ConfirmUserAction({
  state,
  onClose,
  onPassword,
}: {
  state: ConfirmState | null;
  onClose: () => void;
  onPassword: (info: TemporaryPasswordInfo) => void;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const copy = state ? CONFIRM_COPY[state.kind] : null;

  function close() {
    setError(null);
    onClose();
  }

  function run() {
    if (!state || !copy) return;
    const { kind, user } = state;
    startTransition(async () => {
      const input = { userId: user.id };
      if (kind === "reset") {
        const result = await resetPasswordAction(input);
        if (!result.ok) return setError(result.error);
        close();
        onPassword({
          reason: "reset",
          name: result.name,
          email: result.email,
          password: result.temporaryPassword,
        });
        return;
      }
      const result =
        kind === "deactivate"
          ? await deactivateUserAction(input)
          : await reactivateUserAction(input);
      if (!result.ok) return setError(result.error);
      toast.success(copy.done);
      close();
    });
  }

  return (
    <AlertDialog open={state !== null} onOpenChange={(open) => !open && !pending && close()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{copy?.title}</AlertDialogTitle>
          <AlertDialogDescription>{state && copy?.body(state.user.name)}</AlertDialogDescription>
        </AlertDialogHeader>
        {error && <FormAlert>{error}</FormAlert>}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
          <Button
            variant={state?.kind === "deactivate" ? "destructive" : "default"}
            onClick={run}
            disabled={pending}
          >
            {pending && <LoaderCircle className="animate-spin" aria-hidden="true" />}
            {copy?.button}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
