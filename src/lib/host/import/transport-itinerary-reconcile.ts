import { and, eq, inArray, like, or } from "drizzle-orm";

import { db } from "@/lib/db/client";
import { itineraryItems } from "@/lib/db/schema";
import type { IntercityLegDraft, TransportLegDraft } from "@/lib/host/wizard/types";

const WIZARD_TRANSPORT_SOURCES = ["outbound", "return", "intercity"] as const;

function legIdFromTransportHostNote(hostNote: string | null): string | null {
  if (!hostNote?.trim()) return null;
  const match = /^(?:outbound|return|intercity):([^:]+):(?:depart|arrive)$/.exec(hostNote.trim());
  return match?.[1] ?? null;
}

/** AI day import duplicates — real transport lives in wizard outbound/return/intercity items. */
export function isSpuriousImportedTransportActivity(title: string): boolean {
  const t = title.trim();
  if (/^Train:\s/i.test(t)) return true;
  if (/^Flight\s+[A-Z0-9]+\s*:/i.test(t)) return true;
  if (/^Fly\s+.+\s+to\s+/i.test(t)) return true;
  return false;
}

function transportTitlesForLeg(leg: TransportLegDraft | IntercityLegDraft): string[] {
  const type = leg.transportType.charAt(0).toUpperCase() + leg.transportType.slice(1);
  const ic = leg as IntercityLegDraft;
  const from =
    ic.intercityFromCity?.trim() ||
    leg.fromCity?.trim() ||
    leg.fromStation?.trim() ||
    "departure";
  const to =
    ic.intercityToCity?.trim() ||
    leg.toCity?.trim() ||
    leg.toStation?.trim() ||
    "arrival";

  const titles: string[] = [];
  if (leg.transportType === "plane" && leg.flightNumber?.trim()) {
    titles.push(`Flight ${leg.flightNumber.trim()}: ${from} → ${to}`);
    titles.push(`Flight ${leg.flightNumber.trim()}: ${from} -> ${to}`);
  }
  titles.push(`${type}: ${from} → ${to}`);
  titles.push(`${type}: ${from} -> ${to}`);
  return [...new Set(titles)];
}

export async function purgeTransportItineraryForRemovedLeg(
  tripId: string,
  legId: string,
  leg?: TransportLegDraft | IntercityLegDraft,
): Promise<void> {
  const fingerprints = WIZARD_TRANSPORT_SOURCES.flatMap((source) =>
    (["depart", "arrive"] as const).map((suffix) => `${source}:${legId}:${suffix}`),
  );

  await db
    .delete(itineraryItems)
    .where(
      and(
        eq(itineraryItems.tripId, tripId),
        or(
          ...fingerprints.map((fp) => eq(itineraryItems.hostNote, fp)),
          like(itineraryItems.hostNote, `%${legId}%`),
        ),
      ),
    );

  if (leg) {
    const titles = transportTitlesForLeg(leg);
    for (const title of titles) {
      await db
        .delete(itineraryItems)
        .where(and(eq(itineraryItems.tripId, tripId), eq(itineraryItems.title, title)));
    }
  }
}

export async function purgeSpuriousActivityTransportItems(tripId: string): Promise<void> {
  const rows = await db
    .select({ id: itineraryItems.id, title: itineraryItems.title })
    .from(itineraryItems)
    .where(
      and(eq(itineraryItems.tripId, tripId), eq(itineraryItems.wizardSource, "activity")),
    );

  for (const row of rows) {
    if (isSpuriousImportedTransportActivity(row.title)) {
      await db.delete(itineraryItems).where(eq(itineraryItems.id, row.id));
    }
  }
}

export async function reconcileTransportItineraryItems(
  tripId: string,
  legs: {
    outboundLegs: TransportLegDraft[];
    returnLegs: TransportLegDraft[];
    intercityLegs: IntercityLegDraft[];
  },
): Promise<void> {
  const legIds = new Set(
    [...legs.outboundLegs, ...legs.returnLegs, ...legs.intercityLegs].map((l) => l.id),
  );

  const transportRows = await db
    .select({
      id: itineraryItems.id,
      hostNote: itineraryItems.hostNote,
    })
    .from(itineraryItems)
    .where(
      and(
        eq(itineraryItems.tripId, tripId),
        inArray(itineraryItems.wizardSource, [...WIZARD_TRANSPORT_SOURCES]),
      ),
    );

  for (const row of transportRows) {
    const legId = legIdFromTransportHostNote(row.hostNote);
    if (!legId || !legIds.has(legId)) {
      await db.delete(itineraryItems).where(eq(itineraryItems.id, row.id));
    }
  }

  await purgeSpuriousActivityTransportItems(tripId);
}
