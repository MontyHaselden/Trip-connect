import { and, eq } from "drizzle-orm";

import { db } from "@/lib/db/client";
import { groups } from "@/lib/db/schema";

export async function ensureMainGroupForTrip(tripId: string): Promise<string> {
  const existing = await db
    .select({ id: groups.id })
    .from(groups)
    .where(and(eq(groups.tripId, tripId), eq(groups.isMain, true)))
    .limit(1)
    .then((rows) => rows[0] ?? null);

  if (existing) return existing.id;

  const [created] = await db
    .insert(groups)
    .values({
      tripId,
      name: "Main Group",
      type: "other",
      sortOrder: 0,
      isMain: true,
    })
    .returning({ id: groups.id });

  if (!created) throw new Error("Could not create Main Group");
  return created.id;
}

export async function getMainGroupId(tripId: string): Promise<string | null> {
  const row = await db
    .select({ id: groups.id })
    .from(groups)
    .where(and(eq(groups.tripId, tripId), eq(groups.isMain, true)))
    .limit(1)
    .then((rows) => rows[0] ?? null);
  return row?.id ?? null;
}
