import { redirect } from "next/navigation";

import { tripOsHomePath } from "@/lib/trip-os/paths";

export default function DashboardNextRedirectPage() {
  redirect(tripOsHomePath());
}
