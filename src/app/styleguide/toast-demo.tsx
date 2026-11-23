"use client";

import { toast } from "sonner";
import { Button } from "@/components/ui/button";

export function ToastDemo() {
  return (
    <div className="flex flex-wrap gap-2">
      <Button
        variant="outline"
        onClick={() => toast.success("Sale recorded — Receipt R-2026-000123 · ₵135.00")}
      >
        Success toast
      </Button>
      <Button
        variant="outline"
        onClick={() =>
          toast.error("Couldn't save the sale", {
            action: { label: "Try again", onClick: () => undefined },
          })
        }
      >
        Error toast
      </Button>
    </div>
  );
}
