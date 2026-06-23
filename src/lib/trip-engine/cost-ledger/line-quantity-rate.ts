import type { TripEntityGraph } from "../types";

import { effectiveStayNights, stayForLine } from "./accommodation-nights";
import type { CostLineItemDraft } from "./types";

/** Nights at a stay, or manual qty on fee/extra lines. */
export function effectiveLineQuantity(
  line: CostLineItemDraft,
  graph?: TripEntityGraph | null,
): number | null {
  const stay = stayForLine(line, graph);
  if (stay) {
    const nights = effectiveStayNights(line, graph);
    return nights != null && nights > 0 ? nights : null;
  }
  if (line.quantity != null && line.quantity > 0) return line.quantity;
  return null;
}

export function quantityUnitLabel(line: CostLineItemDraft, graph?: TripEntityGraph | null): string {
  return stayForLine(line, graph) ? "night" : "each";
}

export function perUnitCents(totalCents: number, quantity: number): number | null {
  if (quantity <= 0 || totalCents <= 0) return null;
  return Math.round(totalCents / quantity);
}

export function totalFromUnitCents(unitCents: number, quantity: number): number {
  return unitCents * quantity;
}
