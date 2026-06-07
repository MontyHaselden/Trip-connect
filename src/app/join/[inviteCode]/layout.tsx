import type { Metadata } from "next";
import { eq } from "drizzle-orm";

import { db } from "@/lib/db/client";
import { trips } from "@/lib/db/schema";
import { studentJoinPath } from "@/lib/mobile/trip-storage";

export async function generateMetadata(props: {
  params: Promise<{ inviteCode: string }>;
}): Promise<Metadata> {
  const { inviteCode } = await props.params;
  const trip = await db
    .select({ name: trips.name })
    .from(trips)
    .where(eq(trips.inviteCode, inviteCode))
    .limit(1)
    .then((rows) => rows[0] ?? null);

  const tripName = trip?.name ?? "Trip Connect";
  const manifest = `/api/manifest?name=${encodeURIComponent(tripName)}&startUrl=${encodeURIComponent(studentJoinPath(inviteCode))}`;

  return {
    title: `Join ${tripName}`,
    applicationName: tripName,
    manifest,
    appleWebApp: {
      capable: true,
      title: tripName,
      statusBarStyle: "default",
    },
  };
}

export default function JoinLayout(props: { children: React.ReactNode }) {
  return props.children;
}
