import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";

import { MobileJoinClient } from "@/components/mobile/MobileJoinClient";
import { db } from "@/lib/db/client";
import { trips } from "@/lib/db/schema";

export default async function MobileJoinPage(props: {
  params: Promise<{ inviteCode: string }>;
}) {
  const { inviteCode } = await props.params;

  const trip = await db
    .select({ name: trips.name })
    .from(trips)
    .where(eq(trips.inviteCode, inviteCode))
    .limit(1)
    .then((rows) => rows[0] ?? null);

  if (!trip) notFound();

  return <MobileJoinClient inviteCode={inviteCode} tripName={trip.name} />;
}
