import { ShieldX } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { HOME_PATH } from "@/lib/routes";

/** Friendly 403: the user is signed in but their role can't open this page. */
export function ForbiddenNotice() {
  return (
    <Card className="mx-auto mt-6 max-w-md text-center" data-testid="forbidden">
      <CardContent className="flex flex-col items-center gap-3 py-6">
        <div className="flex size-14 items-center justify-center rounded-full bg-danger/10 text-danger">
          <ShieldX className="size-7" aria-hidden="true" />
        </div>
        <h2 className="text-lg font-semibold text-foreground">You don&apos;t have access</h2>
        <p className="text-sm text-muted-foreground">
          Your role can&apos;t open this page. If you need it for your work, ask the owner to change
          your access.
        </p>
        <Button asChild className="mt-2">
          <Link href={HOME_PATH}>Go to dashboard</Link>
        </Button>
      </CardContent>
    </Card>
  );
}
