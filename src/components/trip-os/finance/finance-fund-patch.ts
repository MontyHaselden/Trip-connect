import type { TripFundDraft } from "@/lib/trip-engine/cost-ledger/types";

function toWholeCents(value: number): number {
  return Math.trunc(value);
}

export function patchFundParticipantAllocation(
  fund: TripFundDraft,
  participantId: string,
  amountCents: number | null,
): Record<string, unknown> {
  const pinned = { ...(fund.allocationRulePayload.pinnedAllocations ?? {}) };
  if (amountCents == null || amountCents <= 0) {
    delete pinned[participantId];
  } else {
    pinned[participantId] = toWholeCents(amountCents);
  }

  const pinnedSum = Object.values(pinned).reduce((sum, cents) => sum + cents, 0);
  const payload: Record<string, unknown> = {
    allocationRulePayload: {
      ...fund.allocationRulePayload,
      pinnedAllocations: pinned,
    },
  };
  if (pinnedSum > 0 && fund.amountCents < pinnedSum) {
    payload.amountCents = pinnedSum;
  }
  return payload;
}

export function patchBulkFundAllocations(
  fund: TripFundDraft,
  updates: { participantId: string; amountCents: number }[],
): Record<string, unknown> {
  const pinned = { ...(fund.allocationRulePayload.pinnedAllocations ?? {}) };
  for (const { participantId, amountCents } of updates) {
    if (amountCents <= 0) delete pinned[participantId];
    else pinned[participantId] = toWholeCents(amountCents);
  }

  const pinnedSum = Object.values(pinned).reduce((sum, cents) => sum + cents, 0);
  return {
    allocationRulePayload: {
      ...fund.allocationRulePayload,
      pinnedAllocations: pinned,
    },
    ...(pinnedSum > 0 ? { amountCents: pinnedSum } : {}),
  };
}

export function fundHasPinnedPrices(fund: TripFundDraft): boolean {
  const pinned = fund.allocationRulePayload.pinnedAllocations;
  return Boolean(pinned && Object.keys(pinned).length > 0);
}
