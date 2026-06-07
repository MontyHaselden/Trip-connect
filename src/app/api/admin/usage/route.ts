import { count, sql } from "drizzle-orm";
import { NextResponse } from "next/server";

import { adminApiError } from "@/lib/admin/api-errors";
import { requireAdminRole } from "@/lib/admin/permissions";
import { db } from "@/lib/db/client";
import {
  aiUsageEvents,
  participants,
  payshareSessions,
  tripPhotos,
} from "@/lib/db/schema";

export async function GET() {
  try {
    await requireAdminRole("support");

    const [photos] = await db.select({ n: count() }).from(tripPhotos);
    const [participantsCount] = await db.select({ n: count() }).from(participants);
    const [aiAgg] = await db
      .select({
        calls: sql<number>`coalesce(sum(${aiUsageEvents.callCount}), 0)`,
        cost: sql<number>`coalesce(sum(${aiUsageEvents.estimatedCostCents}), 0)`,
        accounts: sql<number>`count(distinct ${aiUsageEvents.accountId})`,
      })
      .from(aiUsageEvents);
    const [payshareVol] = await db
      .select({
        sessions: count(),
        amount: sql<number>`coalesce(sum(${payshareSessions.amountCents}), 0)`,
      })
      .from(payshareSessions);

    return NextResponse.json({
      photos: photos?.n ?? 0,
      participants: participantsCount?.n ?? 0,
      ai: {
        calls: Number(aiAgg?.calls ?? 0),
        costCents: Number(aiAgg?.cost ?? 0),
        accounts: Number(aiAgg?.accounts ?? 0),
      },
      payshare: {
        sessions: payshareVol?.sessions ?? 0,
        volumeCents: Number(payshareVol?.amount ?? 0),
      },
    });
  } catch (err) {
    return adminApiError(err);
  }
}
