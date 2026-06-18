import type { TripSetupState, SetupSectionId } from "@/lib/host/setup/types";
import type {
  AccommodationStayDraft,
  ActivityDraft,
  DayPlaceDraft,
  IntercityLegDraft,
  TransportLegDraft,
} from "@/lib/host/wizard/types";
import type { NightBoundary } from "@/lib/host/setup/stay-boundaries";
import type { LocationPaletteSwatch } from "@/lib/host/wizard/location-stays";

export type BookingDetailsSummary = {
  id: string;
  entityType: string;
  entityId: string;
  bookingStatus: string;
  supplier: string | null;
  bookingReference: string | null;
};

export type EmergencySummary = {
  localEmergencyNumber: string | null;
  schoolEmergencyPhone: string | null;
  contactsCount: number;
  phrasesCount: number;
};

export type PublishSummary = {
  publishedVersion: number;
  viewerGalleryEnabled: boolean;
  viewerRoomDetailsEnabled: boolean;
};

/** Authoritative server graph — mirrors persisted entities. */
export type TripEntityGraph = TripSetupState & {
  tripId: string;
  bookingsSummary: BookingDetailsSummary[];
  emergencySummary: EmergencySummary;
  publishSummary: PublishSummary;
};

export type EngineWarningSeverity = "error" | "warning" | "info";

export type EngineWarning = {
  id: string;
  severity: EngineWarningSeverity;
  section: string;
  message: string;
  entityType?: string;
  entityId?: string;
  date?: string;
};

export type EngineConflictSeverity = "blocking" | "ambiguous";

export type EngineConflict = {
  id: string;
  severity: EngineConflictSeverity;
  section: string;
  message: string;
  entityType?: string;
  entityId?: string;
  date?: string;
};

export type CommandResult = {
  graph: TripEntityGraph;
  warnings: EngineWarning[];
  conflicts: EngineConflict[];
};

export type TransportOverlay = {
  legId: string;
  label: string;
  transportType: string;
  bookingStatus: string;
};

export type ActivityMarker = {
  id: string;
  title: string;
  startTime: string | null;
  endTime: string | null;
  category: string;
  bookingStatus: string;
};

export type DayWarning = {
  id: string;
  message: string;
  severity: EngineWarningSeverity;
};

export type OverlayMeta = "inherit" | "override" | "add" | "hidden";

export type ProjectedDay = {
  date: string;
  groupId: string;
  primaryCity: string;
  secondaryCity: string | null;
  primaryShare: number;
  dayType: DayPlaceDraft["dayType"];
  accommodationLabel: string | null;
  transportOverlays: TransportOverlay[];
  activities: ActivityMarker[];
  warnings: DayWarning[];
  overlayMeta: OverlayMeta;
};

export type CalendarProjection = {
  groupId: string;
  gridStart: string;
  gridEnd: string;
  days: ProjectedDay[];
  accommodationByDate: Map<string, string>;
  boundaries: NightBoundary[];
};

export type EngineReadinessStatus =
  | "complete"
  | "mostly_complete"
  | "warning"
  | "question"
  | "conflict"
  | "idle";

export type EngineSectionReadiness = {
  id: SetupSectionId;
  label: string;
  status: EngineReadinessStatus;
  message?: string;
};

export type CalendarRenderModel = {
  groupId: string;
  gridStart: string;
  gridEnd: string;
  tripStart: string;
  tripEnd: string;
  departureCity: string;
  returnCity: string;
  datesUnset: boolean;
  days: DayPlaceDraft[];
  baseDays?: DayPlaceDraft[];
  overlayMetaByDate: Map<string, OverlayMeta>;
  travelLayoutsByDate: Map<string, import("@/lib/host/wizard/transport-day-placement").CalendarDaySegment[]>;
  transitByDate: Map<string, import("@/lib/host/wizard/transport-day-placement").TransitOverlay[]>;
  accommodationByDate: Map<string, string>;
  accommodationStays: AccommodationStayDraft[];
  boundaries: NightBoundary[];
  activitiesByDate: Map<string, ActivityMarker[]>;
  projectedDays: ProjectedDay[];
  /** Trip-scoped location colors — distinct slots per city on this trip. */
  locationColorByKey: Map<string, LocationPaletteSwatch>;
  scrollAnchorDate: string;
  /** First selectable/rendered day — never before today in trip timezone. */
  todayIso: string;
  interactionStart: string;
};

export type SetupEngineResponse = {
  graph: TripEntityGraph;
  calendarProjection: CalendarProjection;
  calendarRenderModel: CalendarRenderModel;
  readiness: EngineSectionReadiness[];
  warnings: EngineWarning[];
  conflicts: EngineConflict[];
  inviteCode?: string;
};

export type {
  AccommodationStayDraft,
  ActivityDraft,
  DayPlaceDraft,
  IntercityLegDraft,
  TransportLegDraft,
};
