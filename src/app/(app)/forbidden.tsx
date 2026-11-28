import { ForbiddenNotice } from "@/components/layout/forbidden-notice";

/** Rendered (with HTTP 403) when guardRoute() calls forbidden() inside the app shell. */
export default function Forbidden() {
  return <ForbiddenNotice />;
}
