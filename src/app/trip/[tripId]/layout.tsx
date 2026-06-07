import type { Metadata } from "next";
import { eq } from "drizzle-orm";

import { TripAppShell } from "@/components/layout/TripAppShell";
import { db } from "@/lib/db/client";
import { trips } from "@/lib/db/schema";
import { studentTripTodayPath } from "@/lib/mobile/trip-storage";

export async function generateMetadata(props: {
  params: Promise<{ tripId: string }>;
}): Promise<Metadata> {
  const { tripId } = await props.params;
  const trip = await db
    .select({ name: trips.name })
    .from(trips)
    .where(eq(trips.id, tripId))
    .limit(1)
    .then((rows) => rows[0] ?? null);

  const tripName = trip?.name ?? "Trip Connect";
  const manifest = `/api/manifest?name=${encodeURIComponent(tripName)}&startUrl=${encodeURIComponent(studentTripTodayPath(tripId))}`;

  return {
    title: tripName,
    applicationName: tripName,
    manifest,
    appleWebApp: {
      capable: true,
      title: tripName,
      statusBarStyle: "default",
    },
  };
}

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
