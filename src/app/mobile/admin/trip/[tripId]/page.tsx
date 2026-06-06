import { redirect } from "next/navigation";

export default async function MobileAdminTripIndex({
  params,
}: {
  params: Promise<{ tripId: string }>;
}) {
  const { tripId } = await params;
  redirect(`/mobile/admin/trip/${tripId}/people`);
}
