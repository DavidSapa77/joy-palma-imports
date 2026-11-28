import type { Metadata } from "next";

import { UsersManager } from "@/components/users/users-manager";
import { guardRoute } from "@/lib/route-guard.server";
import { getTimeZone } from "@/server/queries/settings";
import { listUsers } from "@/server/queries/users";

export const metadata: Metadata = { title: "Users · Joy Palma Imports" };

export default async function UsersPage() {
  const session = await guardRoute("/admin/users");
  const users = await listUsers(await getTimeZone());
  return <UsersManager users={users} currentUserId={session.user.id} />;
}
