import type { Role } from "@prisma/client";
import type { DefaultSession } from "next-auth";

/** Fields our session/JWT carry, shared by the augmentations below. */
type AppUserFields = {
  role: Role;
  mustChangePassword: boolean;
};

declare module "next-auth" {
  /** What `authorize()` returns. */
  interface User extends AppUserFields {
    id: string;
    name: string;
    email: string;
  }

  interface Session {
    user: AppUserFields & {
      id: string;
      name: string;
      email: string;
    } & Omit<DefaultSession["user"], "id" | "name" | "email">;
  }
}

// next-auth/jwt re-exports this module; augment the original so the types merge.
declare module "@auth/core/jwt" {
  interface JWT extends AppUserFields {
    id: string;
    name: string;
    email: string;
    /** Epoch ms when the user row was last re-checked against the database. */
    checkedAt: number;
  }
}
