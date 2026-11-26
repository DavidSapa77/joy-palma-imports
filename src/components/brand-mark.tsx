import { cn } from "@/lib/utils";

/** Logo placeholder until a real logo is uploaded in Settings: "JP" monogram on brand teal. */
export function BrandMark({ className }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        "relative flex size-14 items-center justify-center rounded-xl bg-primary text-xl font-bold tracking-tight text-primary-foreground shadow-card",
        className,
      )}
    >
      JP
      <span className="absolute bottom-2.5 h-0.5 w-6 rounded-full bg-gold" />
    </div>
  );
}
