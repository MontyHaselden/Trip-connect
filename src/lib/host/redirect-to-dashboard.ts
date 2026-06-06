import { redirect } from "next/navigation";

import { getTripByInviteCode } from "@/lib/host/get-trip-by-id";

export async function redirectHostManageToDashboard(
  inviteCode: string,
  section:
    | "builder"
    | "participants"
    | "photos"
    | "viewers"
    | "settings" = "builder",
) {
  const trip = await getTripByInviteCode(inviteCode);
  if (!trip) redirect("/dashboard");
  const path =
    section === "builder"
      ? `/dashboard/trips/${trip.id}/builder`
      : `/dashboard/trips/${trip.id}/${section}`;
  redirect(path);
}
