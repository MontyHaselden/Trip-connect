import { asc, eq } from "drizzle-orm";

import { db } from "@/lib/db/client";
import { tripTransportProducts } from "@/lib/db/schema";
import type {
  TransportProductDraft,
  TransportProductKind,
} from "@/lib/host/wizard/types";

function parseParticipantIds(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((id): id is string => typeof id === "string" && id.length > 0);
}

export async function loadTransportProducts(tripId: string): Promise<TransportProductDraft[]> {
  const rows = await db
    .select()
    .from(tripTransportProducts)
    .where(eq(tripTransportProducts.tripId, tripId))
    .orderBy(asc(tripTransportProducts.sortOrder));

  return rows.map((row) => ({
    id: row.id,
    kind: row.kind as TransportProductKind,
    name: row.name,
    participantIds: parseParticipantIds(row.participantIds),
    notes: row.notes,
  }));
}

export async function syncTransportProductsTable(
  tripId: string,
  products: TransportProductDraft[],
): Promise<void> {
  const incomingIds = new Set(products.map((p) => p.id));

  const existing = await db
    .select({ id: tripTransportProducts.id })
    .from(tripTransportProducts)
    .where(eq(tripTransportProducts.tripId, tripId));

  for (const row of existing) {
    if (!incomingIds.has(row.id)) {
      await db.delete(tripTransportProducts).where(eq(tripTransportProducts.id, row.id));
    }
  }

  for (let i = 0; i < products.length; i++) {
    const product = products[i]!;
    const values = {
      id: product.id,
      tripId,
      kind: product.kind,
      name: product.name.trim() || "Transport product",
      participantIds: product.participantIds,
      notes: product.notes?.trim() || null,
      sortOrder: i,
    };

    if (existing.some((row) => row.id === product.id)) {
      await db
        .update(tripTransportProducts)
        .set(values)
        .where(eq(tripTransportProducts.id, product.id));
    } else {
      await db.insert(tripTransportProducts).values(values);
    }
  }
}

export function legsForTransportProduct(
  graph: {
    outboundLegs: { id: string; transportProductId?: string | null }[];
    returnLegs: { id: string; transportProductId?: string | null }[];
    intercityLegs: { id: string; transportProductId?: string | null }[];
  },
  productId: string,
): string[] {
  const all = [...graph.outboundLegs, ...graph.returnLegs, ...graph.intercityLegs];
  return all.filter((leg) => leg.transportProductId === productId).map((leg) => leg.id);
}

export function findTransportProduct(
  products: TransportProductDraft[],
  productId: string | null | undefined,
): TransportProductDraft | null {
  if (!productId) return null;
  return products.find((p) => p.id === productId) ?? null;
}
