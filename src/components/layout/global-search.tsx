"use client";

import { Search } from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandInput,
  CommandList,
} from "@/components/ui/command";

/**
 * Global product search (UI spec §4.2, ⌘K / Ctrl+K). Placeholder until the
 * product list exists (Task 4.1); the dialog and shortcut are already wired.
 */
export function GlobalSearch() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key.toLowerCase() === "k" && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        setOpen((o) => !o);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  return (
    <>
      <Button
        variant="outline"
        aria-label="Search products"
        onClick={() => setOpen(true)}
        className="size-11 p-0 text-muted-foreground lg:h-9 lg:w-64 lg:justify-start lg:gap-2 lg:px-3"
      >
        <Search aria-hidden="true" />
        <span className="hidden lg:inline">Search products…</span>
        <kbd className="ml-auto hidden rounded border bg-muted px-1.5 font-sans text-[11px] lg:inline">
          ⌘K
        </kbd>
      </Button>
      <CommandDialog
        open={open}
        onOpenChange={setOpen}
        title="Search products"
        description="Find a product by name or SKU"
      >
        <Command>
          <CommandInput placeholder="Search products by name or SKU…" />
          <CommandList>
            <CommandEmpty>Product search is coming soon.</CommandEmpty>
          </CommandList>
        </Command>
      </CommandDialog>
    </>
  );
}
