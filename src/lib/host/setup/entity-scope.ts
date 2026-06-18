import type {
  AccommodationStayDraft,
  IntercityLegDraft,
  TransportLegDraft,
} from "@/lib/host/wizard/types";

import type { TripSetupState } from "./types";

export function isMainOwned(
  entity: { originGroupId?: string | null },
  mainGroupId: string,
): boolean {
  return !entity.originGroupId || entity.originGroupId === mainGroupId;
}

export function mainIntercityLegs(state: TripSetupState): IntercityLegDraft[] {
  return state.intercityLegs.filter((l) => isMainOwned(l, state.mainGroupId));
}

export function groupIntercityLegs(
  state: TripSetupState,
  groupId: string,
): IntercityLegDraft[] {
  return state.intercityLegs.filter((l) => l.originGroupId === groupId);
}

export function mainAccommodationStays(state: TripSetupState): AccommodationStayDraft[] {
  return state.accommodationStays.filter((s) => isMainOwned(s, state.mainGroupId));
}

export function groupAccommodationStays(
  state: TripSetupState,
  groupId: string,
): AccommodationStayDraft[] {
  return state.accommodationStays.filter((s) => s.originGroupId === groupId);
}

export function mergeIntercityLegs(
  state: TripSetupState,
  groupId: string,
  groupLegs: IntercityLegDraft[],
): IntercityLegDraft[] {
  const others = state.intercityLegs.filter((l) => l.originGroupId !== groupId);
  return [...others, ...groupLegs.map((l) => ({ ...l, originGroupId: groupId }))];
}

export function mergeAccommodationStays(
  state: TripSetupState,
  groupId: string,
  groupStays: AccommodationStayDraft[],
): AccommodationStayDraft[] {
  const others =
    groupId === state.mainGroupId
      ? state.accommodationStays.filter((s) => !isMainOwned(s, state.mainGroupId))
      : state.accommodationStays.filter((s) => s.originGroupId !== groupId);
  return [...others, ...groupStays.map((s) => ({ ...s, originGroupId: groupId }))];
}

export function mainTransportLegs(state: TripSetupState): {
  outboundLegs: TransportLegDraft[];
  returnLegs: TransportLegDraft[];
  intercityLegs: IntercityLegDraft[];
  accommodationStays: AccommodationStayDraft[];
} {
  return {
    outboundLegs: state.outboundLegs,
    returnLegs: state.returnLegs,
    intercityLegs: mainIntercityLegs(state),
    accommodationStays: mainAccommodationStays(state),
  };
}
