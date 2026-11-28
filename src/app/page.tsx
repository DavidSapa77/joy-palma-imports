import { redirect } from "next/navigation";

import { HOME_PATH } from "@/lib/routes";

/** "/" → the dashboard (middleware has already sent signed-out users to /login). */
export default function Home(): never {
  redirect(HOME_PATH);
}
