import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import { getHostSession, setHostSessionCookie } from "@/lib/auth/host-session";
import { db } from "@/lib/db/client";
import { hostAccounts } from "@/lib/db/schema";
import { getHostAccountById } from "@/lib/host/auth";
import { createTripShell } from "@/lib/host/create-trip-with-document";
import { getActiveTripCountForAccount } from "@/lib/plans/account-usage";
import { enforceActiveTripLimit } from "@/lib/plans/enforce-plan";

export async function GET(request: Request) {
  const session = await getHostSession();
  if (!session) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const account = await getHostAccountById(session.hostId);
  if (!account) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const hostRow = await db
    .select({ pausedAt: hostAccounts.pausedAt })
    .from(hostAccounts)
    .where(eq(hostAccounts.id, session.hostId))
    .limit(1)
    .then((rows) => rows[0] ?? null);

  if (hostRow?.pausedAt) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  const activeTripCount = await getActiveTripCountForAccount(session.hostId);
  const planCheck = await enforceActiveTripLimit({
    accountId: session.hostId,
    activeTripCount,
  });
  if (!planCheck.allowed) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  const trip = await createTripShell({
    hostId: session.hostId,
    name: "New trip",
  });

  await setHostSessionCookie({ hostId: session.hostId, activeTripId: trip.id });

  return NextResponse.redirect(
    new URL(`/dashboard/trips/${trip.id}`, request.url),
  );
}
