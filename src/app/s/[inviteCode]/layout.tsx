import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { StudentAppRoot } from "@/components/student/StudentAppRoot";
import { loadTripByAnyInviteCode } from "@/lib/join/load-trip-by-invite";
import { plusJakartaSans } from "@/lib/fonts/student-font";
import { buildTripManifestHref } from "@/lib/mobile/wire-pwa-head";
import { studentAppPath } from "@/lib/mobile/trip-storage";

export async function generateMetadata(props: {
  params: Promise<{ inviteCode: string }>;
}): Promise<Metadata> {
  const { inviteCode } = await props.params;
  const trip = await loadTripByAnyInviteCode(inviteCode);
  const tripName = trip?.name ?? "Trip Connect";
  const appPath = studentAppPath(trip?.tripInviteCode ?? inviteCode);
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
  const trip = await loadTripByAnyInviteCode(inviteCode);
  if (!trip) notFound();

  return (
    <div className={`${plusJakartaSans.variable} student-app min-h-dvh`}>
      <StudentAppRoot
        inviteCode={trip.tripInviteCode}
        joinInviteCode={inviteCode}
        tripId={trip.id}
        tripName={trip.name}
      >
        {props.children}
      </StudentAppRoot>
    </div>
  );
}
