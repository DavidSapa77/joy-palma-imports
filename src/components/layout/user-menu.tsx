"use client";

import type { Role } from "@prisma/client";
import { ChevronsUpDown, KeyRound, LogOut } from "lucide-react";
import Link from "next/link";
import { useTransition } from "react";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { SET_PASSWORD_PATH } from "@/lib/auth.config";
import { ROLE_LABELS } from "@/lib/permissions";
import { signOutAction } from "@/server/actions/auth";

export type ShellUser = { name: string; email: string; role: Role };

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const letters = parts.length > 1 ? [parts[0]![0], parts.at(-1)![0]] : [parts[0]?.[0]];
  return letters.join("").toUpperCase() || "?";
}

export function RoleBadge({ role }: { role: Role }) {
  return (
    <Badge variant={role === "OWNER" ? "gold" : "secondary"} data-testid="role-badge">
      {ROLE_LABELS[role]}
    </Badge>
  );
}

/** Top-bar user menu: name, role badge, change password, sign out (UI spec §4.2). */
export function UserMenu({ user }: { user: ShellUser }) {
  const [signingOut, startSignOut] = useTransition();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          aria-label="Account menu"
          className="h-11 gap-2 rounded-full px-0.5 sm:h-11 lg:rounded-md lg:px-2"
        >
          <Avatar className="size-9">
            <AvatarFallback className="bg-primary text-xs font-semibold text-primary-foreground">
              {initials(user.name)}
            </AvatarFallback>
          </Avatar>
          <span className="hidden max-w-40 truncate text-sm font-medium lg:inline">
            {user.name}
          </span>
          <ChevronsUpDown className="hidden text-muted-foreground lg:block" aria-hidden="true" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel className="flex flex-col gap-1.5 py-2 font-normal">
          <span className="truncate text-sm font-semibold text-foreground">{user.name}</span>
          <span className="truncate text-xs text-muted-foreground">{user.email}</span>
          <RoleBadge role={user.role} />
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild className="min-h-11 sm:min-h-9">
          <Link href={SET_PASSWORD_PATH}>
            <KeyRound aria-hidden="true" />
            Change password
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem
          className="min-h-11 sm:min-h-9"
          disabled={signingOut}
          onSelect={() => startSignOut(() => signOutAction())}
        >
          <LogOut aria-hidden="true" />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
