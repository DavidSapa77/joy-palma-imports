import { BrandMark } from "@/components/brand-mark";
import { cn } from "@/lib/utils";
import type { BusinessBrand as Brand } from "@/server/queries/settings";

/** Logo from Settings (or the "JP" monogram) plus the business name (UI spec §4.2). */
export function BusinessBrand({
  brand,
  showName = true,
  className,
}: {
  brand: Brand;
  showName?: boolean;
  className?: string;
}) {
  return (
    <div className={cn("flex min-w-0 items-center gap-3", className)}>
      {brand.logoUrl ? (
        // Uploaded logos can live on any host, so a plain <img> (not next/image) is used.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={brand.logoUrl}
          alt=""
          className="size-9 shrink-0 rounded-lg object-contain"
          width={36}
          height={36}
        />
      ) : (
        <BrandMark className="size-9 shrink-0 rounded-lg text-sm [&>span]:bottom-1.5 [&>span]:w-4" />
      )}
      {showName && (
        <span className="truncate text-sm leading-tight font-semibold text-foreground">
          {brand.name}
        </span>
      )}
    </div>
  );
}
