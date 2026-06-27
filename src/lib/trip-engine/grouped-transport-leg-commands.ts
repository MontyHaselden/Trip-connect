import type { TripCommand } from "./commands";
import type { TransportLegGroupedTarget } from "./group-transport-legs-for-display";
import type { PendingTransportNeed } from "./pending-city-moves";
import { newId, type IntercityLegDraft, type TransportLegDraft } from "@/lib/host/wizard/types";

type LegBucket = "outbound" | "return" | "intercity";

function legPatchFromDraft(
  draft: TransportLegDraft | IntercityLegDraft,
): Partial<IntercityLegDraft> {
  const patch: Partial<IntercityLegDraft> = {
    ...draft,
    transportProductId: draft.transportProductId ?? null,
    billingMode: draft.billingMode ?? "single",
  };
  if ("intercityFromCity" in draft) {
    const ic = draft as IntercityLegDraft;
    patch.intercityFromCity = ic.intercityFromCity || draft.fromCity;
    patch.intercityToCity = ic.intercityToCity || draft.toCity;
  }
  return patch;
}

function pendingNeedFromDraft(
  draft: TransportLegDraft | IntercityLegDraft,
): Pick<PendingTransportNeed, "kind" | "date" | "fromCity" | "toCity"> {
  const fromCity =
    ("intercityFromCity" in draft ? draft.intercityFromCity : null)?.trim() ||
    draft.fromCity.trim();
  const toCity =
    ("intercityToCity" in draft ? draft.intercityToCity : null)?.trim() || draft.toCity.trim();
  return {
    kind: "intercity",
    date: draft.travelDate,
    fromCity,
    toCity,
  };
}

function unhidePendingNeedCommands(groupIds: string[], draft: TransportLegDraft | IntercityLegDraft) {
  const need = pendingNeedFromDraft(draft);
  return groupIds.map(
    (groupId): TripCommand => ({
      type: "unhidePendingTransportNeed",
      groupId,
      need,
    }),
  );
}

function cloneLegForGroup(
  draft: TransportLegDraft | IntercityLegDraft,
  groupId: string,
): IntercityLegDraft {
  return {
    ...(draft as IntercityLegDraft),
    id: newId(),
    originGroupId: groupId,
    intercityFromCity:
      ("intercityFromCity" in draft ? draft.intercityFromCity : null) || draft.fromCity,
    intercityToCity: ("intercityToCity" in draft ? draft.intercityToCity : null) || draft.toCity,
  };
}

/** Apply traveller + leg edits across a grouped personal transport row. */
export function buildGroupedTransportLegCommands(input: {
  draft: TransportLegDraft | IntercityLegDraft;
  bucket: LegBucket;
  groupedLegTargets: TransportLegGroupedTarget[];
  selectedGroupIds: string[];
}): TripCommand[] {
  const { draft, bucket, groupedLegTargets, selectedGroupIds } = input;
  const selected = new Set(selectedGroupIds);
  const patch = legPatchFromDraft(draft);
  const commands: TripCommand[] = [];

  for (const target of groupedLegTargets) {
    if (selected.has(target.groupId)) continue;
    commands.push({
      type: "removeTransportLeg",
      groupId: target.groupId,
      bucket,
      legId: target.legId,
    });
  }

  for (const target of groupedLegTargets) {
    if (!selected.has(target.groupId)) continue;
    commands.push({
      type: "updateTransportLeg",
      groupId: target.groupId,
      bucket,
      legId: target.legId,
      patch,
    });
  }

  const existingGroupIds = new Set(groupedLegTargets.map((target) => target.groupId));
  for (const groupId of selected) {
    if (existingGroupIds.has(groupId)) continue;
    commands.push({
      type: "addClassifiedTransportLegs",
      groupId,
      legs: [cloneLegForGroup(draft, groupId)],
    });
  }

  const removedGroupIds = groupedLegTargets
    .map((target) => target.groupId)
    .filter((groupId) => !selected.has(groupId));
  commands.push(
    ...unhidePendingNeedCommands([...selected], draft),
    ...unhidePendingNeedCommands(removedGroupIds, draft),
  );

  return commands;
}
