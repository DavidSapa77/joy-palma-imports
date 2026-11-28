import { ForbiddenNotice } from "@/components/layout/forbidden-notice";

/** Fallback 403 outside the app shell. */
export default function Forbidden() {
  return (
    <main className="flex min-h-dvh items-center justify-center p-4">
      <ForbiddenNotice />
    </main>
  );
}
