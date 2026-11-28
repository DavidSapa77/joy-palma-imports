"use client";

import { Check, Copy, TriangleAlert } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export type TemporaryPasswordInfo = {
  reason: "created" | "reset";
  name: string;
  email: string;
  password: string;
};

/**
 * Shows a temporary password exactly once (UI spec §4.14). It is never stored
 * in plain text, so closing this dialog is final — the dialog only closes via
 * the explicit button, not by clicking outside or pressing Escape.
 */
export function TemporaryPasswordDialog({
  info,
  onClose,
}: {
  info: TemporaryPasswordInfo | null;
  onClose: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const codeRef = useRef<HTMLElement>(null);

  async function copy() {
    if (!info) return;
    try {
      await navigator.clipboard.writeText(info.password);
      setCopied(true);
      toast.success("Password copied");
    } catch {
      // Clipboard blocked (e.g. insecure context): select it for manual copying.
      const range = document.createRange();
      if (codeRef.current) range.selectNodeContents(codeRef.current);
      window.getSelection()?.removeAllRanges();
      window.getSelection()?.addRange(range);
      toast.error("Couldn't copy automatically — the password is selected, copy it manually");
    }
  }

  return (
    <Dialog
      open={info !== null}
      onOpenChange={(open) => {
        if (!open) {
          setCopied(false);
          onClose();
        }
      }}
    >
      <DialogContent
        showCloseButton={false}
        onInteractOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
        className="sm:max-w-md"
      >
        <DialogHeader>
          <DialogTitle>{info?.reason === "created" ? "User added" : "Password reset"}</DialogTitle>
          <DialogDescription>
            Give this temporary password to{" "}
            <strong className="text-foreground">{info?.name}</strong> ({info?.email}). They&apos;ll
            be asked to choose their own password when they sign in.
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center gap-2 rounded-lg border bg-muted/50 p-3">
          <code
            ref={codeRef}
            data-testid="temporary-password"
            className="min-w-0 flex-1 font-mono text-lg font-semibold tracking-wider break-all text-foreground select-all"
          >
            {info?.password}
          </code>
          <Button variant="outline" onClick={copy} aria-label="Copy password">
            {copied ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}
            {copied ? "Copied" : "Copy"}
          </Button>
        </div>

        <p
          role="note"
          className="flex items-start gap-2 rounded-lg border border-warning/40 bg-warning/10 px-3 py-2.5 text-sm text-warning-text"
        >
          <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          <span>
            <strong>You won&apos;t see this password again.</strong> Copy it now. If it gets lost,
            reset the password to get a new one.
          </span>
        </p>

        <DialogFooter>
          <Button
            onClick={() => {
              setCopied(false);
              onClose();
            }}
          >
            I&apos;ve copied it — close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
