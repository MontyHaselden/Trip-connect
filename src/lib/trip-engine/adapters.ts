import { stripPlaceholderDayPlaces } from "@/lib/host/setup/placeholder-city";
import type { TripSetupState } from "@/lib/host/setup/types";

import type { TripEntityGraph } from "./types";

const EMPTY_SUMMARIES: Pick<
  TripEntityGraph,
  "bookingsSummary" | "emergencySummary" | "publishSummary"
> = {
  bookingsSummary: [],
  emergencySummary: {
    localEmergencyNumber: null,
    schoolEmergencyPhone: null,
    contactsCount: 0,
    phrasesCount: 0,
  },
  publishSummary: {
    publishedVersion: 0,
    viewerGalleryEnabled: false,
    viewerRoomDetailsEnabled: false,
  },
};

export function setupStateToGraph(tripId: string, state: TripSetupState): TripEntityGraph {
  const dayPlacesByGroupId = Object.fromEntries(
    Object.entries(state.dayPlacesByGroupId).map(([groupId, days]) => [
      groupId,
      stripPlaceholderDayPlaces(days),
    ]),
  );
  return { ...state, dayPlacesByGroupId, tripId, ...EMPTY_SUMMARIES };
}

export function graphToSetupState(graph: TripEntityGraph): TripSetupState {
  const {
    tripId: _tripId,
    bookingsSummary: _bookings,
    emergencySummary: _emergency,
    publishSummary: _publish,
    hiddenPendingTransportNeedKeys: _hiddenPendingTransportNeedKeys,
    ...state
  } = graph;
  return state;
}
