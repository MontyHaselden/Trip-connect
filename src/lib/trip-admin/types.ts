import type {
  AccommodationStayDraft,
  ActivityDraft,
  IntercityLegDraft,
  TransportLegDraft,
} from "@/lib/host/wizard/types";
import type { CalendarLens } from "@/lib/trip-engine/person-lens";
import type { PendingTransportNeed } from "@/lib/trip-engine/pending-city-moves";
import type { CalendarProjection } from "@/lib/trip-engine/types";

export type ScopeLegs = {
  outbound: TransportLegDraft[];
  return: TransportLegDraft[];
  intercity: IntercityLegDraft[];
};

export type AdminScopeSection = {
  groupId: string;
  title: string;
  memberNames: string[];
  participantIds: string[];
  calendar: CalendarProjection;
  stays: AccommodationStayDraft[];
  legs: ScopeLegs;
  activities: ActivityDraft[];
  pendingTransport: PendingTransportNeed[];
  hiddenPendingTransport: PendingTransportNeed[];
  differsFromMain: boolean;
};

/** Full-trip admin lists for Transport, Accommodation, and Activities — no lens input. */
export type TripAdminProjection = {
  wholeGroup: AdminScopeSection;
  personalScopes: AdminScopeSection[];
};

/** Calendar paint target, default Add scope, and UI highlight — separate from admin lists. */
export type CalendarEditContext = {
  lens: CalendarLens;
  editGroupId: string;
  partyGroupIds?: string[];
};
