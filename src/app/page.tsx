import { Button } from "@/components/ui/button";
import { requireSession } from "@/lib/session";
import { signOutAction } from "@/server/actions/auth";

/** Temporary signed-in landing page until the app shell and dashboard (Tasks 2.6, 8.3). */
export default async function Home() {
  const session = await requireSession();
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-3 p-4 text-center">
      <h1 className="text-2xl font-semibold">Joy Palma Imports</h1>
      <p className="text-sm text-muted-foreground">
        Signed in as {session.user.name} · {session.user.role.toLowerCase()}
      </p>
      <p className="text-sm text-muted-foreground">Dashboard coming soon.</p>
      <form action={signOutAction}>
        <Button type="submit" variant="outline">
          Sign out
        </Button>
      </form>
    </main>
  );
}
