import { Construction } from "lucide-react";
import type { ReactNode } from "react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";

/** Stand-in for a screen that is planned but not built yet (docs/PLAN.md). */
export function PagePlaceholder({
  heading,
  description,
  plannedFor,
  children,
}: {
  heading: string;
  description: string;
  /** e.g. "Phase 6" */
  plannedFor: string;
  children?: ReactNode;
}) {
  return (
    <Card data-testid="page-placeholder">
      <CardContent className="flex flex-col items-start gap-3">
        <div className="flex size-11 items-center justify-center rounded-lg bg-secondary text-primary">
          <Construction className="size-5" aria-hidden="true" />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-lg font-semibold text-foreground">{heading}</h2>
          <Badge variant="secondary">Coming in {plannedFor}</Badge>
        </div>
        <p className="text-sm text-muted-foreground">{description}</p>
        {children}
      </CardContent>
    </Card>
  );
}
