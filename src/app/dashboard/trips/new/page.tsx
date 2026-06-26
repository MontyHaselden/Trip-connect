import { redirect } from "next/navigation";

import { tripOsHomePath } from "@/lib/trip-os/paths";

/** Legacy URL — trip creation is POST-only via the dashboard button (never auto-create on GET). */
export default function NewTripRedirectPage() {
  redirect(tripOsHomePath());
}
