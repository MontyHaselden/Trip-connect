import { TripAppShell } from "@/components/layout/TripAppShell";

export default async function TripLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ tripId: string }>;
}) {
  const { tripId } = await params;
  return <TripAppShell tripId={tripId}>{children}</TripAppShell>;
}
