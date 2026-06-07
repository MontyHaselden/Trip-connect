import type { Metadata } from "next";
import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";

import { StudentAppRoot } from "@/components/student/StudentAppRoot";
import { db } from "@/lib/db/client";
import { trips } from "@/lib/db/schema";
import { buildTripManifestHref } from "@/lib/mobile/wire-pwa-head";
import { studentAppPath } from "@/lib/mobile/trip-storage";

async function loadTrip(inviteCode: string) {
  return db
    .select({ id: trips.id, name: trips.name })
    .from(trips)
    .where(eq(trips.inviteCode, inviteCode))
    .limit(1)
    .then((rows) => rows[0] ?? null);
}

export async function generateMetadata(props: {
  params: Promise<{ inviteCode: string }>;
}): Promise<Metadata> {
  const { inviteCode } = await props.params;
  const trip = await loadTrip(inviteCode);
  const tripName = trip?.name ?? "Trip Connect";
  const appPath = studentAppPath(inviteCode);
  const manifest = buildTripManifestHref(tripName, appPath, appPath);

  return {
    title: tripName,
    applicationName: tripName,
    manifest,
    appleWebApp: {
      capable: true,
      title: tripName,
      statusBarStyle: "default",
    },
    icons: {
      icon: [{ url: "/icon-192.png", sizes: "192x192", type: "image/png" }],
      apple: [{ url: "/icon-192.png", sizes: "192x192", type: "image/png" }],
    },
  };
}

export default async function StudentAppLayout(props: {
  children: React.ReactNode;
  params: Promise<{ inviteCode: string }>;
}) {
  const { inviteCode } = await props.params;
  const trip = await loadTrip(inviteCode);
  if (!trip) notFound();

  return (
    <StudentAppRoot inviteCode={inviteCode} tripId={trip.id} tripName={trip.name}>
      {props.children}
    </StudentAppRoot>
  );
}
