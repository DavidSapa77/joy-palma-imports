import { CircleAlert } from "lucide-react";

/** Error banner for auth forms; announced by screen readers. */
export function FormAlert({ children }: { children: React.ReactNode }) {
  return (
    <div
      role="alert"
      data-slot="form-alert"
      className="flex items-start gap-2 rounded-lg border border-danger/30 bg-danger/5 px-3 py-2.5 text-sm text-danger"
    >
      <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
      <p>{children}</p>
    </div>
  );
}
