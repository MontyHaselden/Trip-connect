import { count, sql } from "drizzle-orm";

import { formatCents } from "@/lib/billing/gst";
import { db } from "@/lib/db/client";
import {
  aiUsageEvents,
  participants,
  payshareSessions,
  tripPhotos,
} from "@/lib/db/schema";

export default async function AdminUsagePage() {
  const [photos] = await db.select({ n: count() }).from(tripPhotos);
  const [participantsCount] = await db.select({ n: count() }).from(participants);
  const [aiAgg] = await db
    .select({
      calls: sql<number>`coalesce(sum(${aiUsageEvents.callCount}), 0)`,
      cost: sql<number>`coalesce(sum(${aiUsageEvents.estimatedCostCents}), 0)`,
    })
    .from(aiUsageEvents);
  const [payshareVol] = await db
    .select({
      sessions: count(),
      amount: sql<number>`coalesce(sum(${payshareSessions.amountCents}), 0)`,
    })
    .from(payshareSessions);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold text-zinc-900">Usage</h1>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-zinc-200 bg-white p-4">
          <p className="text-xs uppercase text-zinc-500">Photos</p>
          <p className="mt-1 text-2xl font-semibold">{photos?.n ?? 0}</p>
        </div>
        <div className="rounded-xl border border-zinc-200 bg-white p-4">
          <p className="text-xs uppercase text-zinc-500">Participants</p>
          <p className="mt-1 text-2xl font-semibold">{participantsCount?.n ?? 0}</p>
        </div>
        <div className="rounded-xl border border-zinc-200 bg-white p-4">
          <p className="text-xs uppercase text-zinc-500">AI calls</p>
          <p className="mt-1 text-2xl font-semibold">{Number(aiAgg?.calls ?? 0)}</p>
          <p className="text-xs text-zinc-500">Est. {formatCents(Number(aiAgg?.cost ?? 0))}</p>
        </div>
        <div className="rounded-xl border border-zinc-200 bg-white p-4">
          <p className="text-xs uppercase text-zinc-500">PayShare volume</p>
          <p className="mt-1 text-2xl font-semibold">{payshareVol?.sessions ?? 0}</p>
          <p className="text-xs text-zinc-500">{formatCents(Number(payshareVol?.amount ?? 0))}</p>
        </div>
      </div>
    </div>
  );
}
