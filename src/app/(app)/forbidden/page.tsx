import { forbidden } from "next/navigation";

/**
 * Target of the middleware rewrite for pages the role can't open
 * (lib/auth.config.ts). Calling forbidden() renders the friendly 403 page
 * with HTTP status 403.
 */
export default function ForbiddenPage(): never {
  forbidden();
}
