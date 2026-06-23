/** Split total cents evenly; remainder goes to first N participants. */
export function splitAmountEvenly(
  totalCents: number,
  participantIds: string[],
): Record<string, number> {
  if (!participantIds.length || totalCents === 0) {
    return Object.fromEntries(participantIds.map((id) => [id, 0]));
  }
  const base = Math.trunc(totalCents / participantIds.length);
  let remainder = totalCents - base * participantIds.length;
  const out: Record<string, number> = {};
  for (const id of participantIds) {
    const extra = remainder > 0 ? 1 : 0;
    if (extra) remainder -= 1;
    out[id] = base + extra;
  }
  return out;
}

/** Split total among eligible participants, keeping pinned amounts fixed. */
export function splitWithPinnedOverrides(
  totalCents: number,
  eligibleParticipantIds: string[],
  pinnedOverrides: Record<string, number>,
): Record<string, number> {
  if (!eligibleParticipantIds.length) return {};

  const pinnedIds = eligibleParticipantIds.filter(
    (id) => pinnedOverrides[id] != null,
  );
  const pinnedSum = pinnedIds.reduce((sum, id) => sum + pinnedOverrides[id]!, 0);
  const unpinnedIds = eligibleParticipantIds.filter((id) => !pinnedIds.includes(id));
  const remainder = totalCents - pinnedSum;

  const allocations: Record<string, number> = {};
  for (const id of pinnedIds) {
    allocations[id] = pinnedOverrides[id]!;
  }
  if (unpinnedIds.length) {
    Object.assign(allocations, splitAmountEvenly(Math.max(0, remainder), unpinnedIds));
  }
  return allocations;
}

export function isAllocationBalanced(
  totalCents: number,
  allocations: Record<string, number>,
): boolean {
  const allocatedTotal = Object.values(allocations).reduce((sum, n) => sum + n, 0);
  return allocatedTotal === totalCents;
}
