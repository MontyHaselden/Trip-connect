import type { TripLocationBasics } from "@/lib/host/locations/types";
import type { GroupOverlayOpDraft } from "@/lib/host/setup/types";
import type { HalfSide } from "@/lib/host/wizard/location-stays";
import type {
  AccommodationStayDraft,
  ActivityDraft,
  DayPlaceDraft,
  IntercityLegDraft,
  TransportLegDraft,
} from "@/lib/host/wizard/types";

export type UpdateBasicsCommand = {
  type: "updateBasics";
  basics: Partial<TripLocationBasics>;
};

export type AddStayCommand = {
  type: "addStay";
  groupId: string;
  stay: AccommodationStayDraft;
  /** When true, repaint location labels in the stay date range and detach conflicting transport corridors. */
  replaceLocationLabels?: boolean;
};

export type UpdateStayCommand = {
  type: "updateStay";
  groupId: string;
  stayId: string;
  patch: Partial<AccommodationStayDraft>;
  /** When true, repaint location labels in the stay date range and detach conflicting transport corridors. */
  replaceLocationLabels?: boolean;
};

export type RemoveStayCommand = {
  type: "removeStay";
  groupId: string;
  stayId: string;
};

export type AddTransportLegCommand = {
  type: "addTransportLeg";
  groupId: string;
  bucket: "outbound" | "return" | "intercity";
  leg: TransportLegDraft | IntercityLegDraft;
};

/** Batch add with automatic outbound / return / intercity classification. */
export type AddClassifiedTransportLegsCommand = {
  type: "addClassifiedTransportLegs";
  groupId: string;
  legs: IntercityLegDraft[];
};

export type UpdateTransportLegCommand = {
  type: "updateTransportLeg";
  groupId: string;
  bucket: "outbound" | "return" | "intercity";
  legId: string;
  patch: Partial<TransportLegDraft>;
};

export type RemoveTransportLegCommand = {
  type: "removeTransportLeg";
  groupId: string;
  bucket: "outbound" | "return" | "intercity";
  legId: string;
};

/** @deprecated alias */
export type AddLegCommand = AddTransportLegCommand & { type: "addLeg" };
export type UpdateLegCommand = UpdateTransportLegCommand & { type: "updateLeg" };
export type RemoveLegCommand = RemoveTransportLegCommand & { type: "removeLeg" };

export type PaintDayRangeCommand = {
  type: "paintDayRange";
  groupId: string;
  rangeStart: string;
  rangeEnd: string;
  location: string;
  startHalf?: HalfSide | "full";
  endHalf?: HalfSide | "full";
};

export type ClearDayRangeCommand = {
  type: "clearDayRange";
  groupId: string;
  rangeStart: string;
  rangeEnd: string;
  startHalf?: HalfSide | "full";
  endHalf?: HalfSide | "full";
};

/** @deprecated aliases */
export type PaintDaysCommand = PaintDayRangeCommand & { type: "paintDays" };
export type ClearDaysCommand = ClearDayRangeCommand & { type: "clearDays" };

export type SetDayPlacesCommand = {
  type: "setDayPlaces";
  groupId: string;
  days: DayPlaceDraft[];
};

export type AddActivityCommand = {
  type: "addActivity";
  groupId: string;
  activity: ActivityDraft;
};

export type UpdateActivityCommand = {
  type: "updateActivity";
  groupId: string;
  activityId: string;
  patch: Partial<ActivityDraft>;
};

export type RemoveActivityCommand = {
  type: "removeActivity";
  groupId: string;
  activityId: string;
};

export type CreateGroupCommand = {
  type: "createGroup";
  id?: string;
  name: string;
  groupType: string;
  description?: string | null;
  inheritMode?: "overlay" | "independent" | null;
  personalForParticipantId?: string | null;
};

export type SetGroupInheritModeCommand = {
  type: "setGroupInheritMode";
  groupId: string;
  mode: "overlay" | "independent";
};

export type EnsurePersonalGroupCommand = {
  type: "ensurePersonalGroup";
  participantId: string;
  participantName: string;
  mode: "overlay" | "independent";
};

export type UpdateGroupCommand = {
  type: "updateGroup";
  groupId: string;
  name?: string;
  groupType?: string;
  description?: string | null;
};

export type DeleteGroupCommand = {
  type: "deleteGroup";
  groupId: string;
};

/** Drop a subgroup/personal plan's overrides so it inherits the main group trip again. */
export type ResetGroupFromMainCommand = {
  type: "resetGroupFromMain";
  groupId: string;
};

export type AddGroupDayOverrideCommand = {
  type: "addGroupDayOverride";
  groupId: string;
  op: GroupOverlayOpDraft;
};

export type RemoveGroupDayOverrideCommand = {
  type: "removeGroupDayOverride";
  groupId: string;
  opId: string;
};

export type AddBookingDetailsCommand = {
  type: "addBookingDetails";
  entityType: string;
  entityId: string;
  bookingStatus: string;
  supplier?: string | null;
  bookingReference?: string | null;
};

export type UpdateBookingDetailsCommand = {
  type: "updateBookingDetails";
  bookingId: string;
  patch: Partial<{
    bookingStatus: string;
    supplier: string | null;
    bookingReference: string | null;
  }>;
};

export type SetBookingStatusCommand = {
  type: "setBookingStatus";
  entityType: "transport_leg" | "accommodation_stay" | "itinerary_item";
  entityId: string;
  bookingStatus: string;
};

export type SetEmergencyInfoCommand = {
  type: "setEmergencyInfo";
  localEmergencyNumber?: string | null;
  schoolEmergencyPhone?: string | null;
};

export type SetViewerSettingsCommand = {
  type: "setViewerSettings";
  viewerGalleryEnabled?: boolean;
  viewerRoomDetailsEnabled?: boolean;
};

/** Trim or set trip window — calendar paint is kept; everything else follows in one shot. */
export type SetTripDateRangeCommand = {
  type: "setTripDateRange";
  startDate: string;
  endDate: string;
};

/** Shift all dated trip content by N days or whole months (negative = earlier). */
export type ShiftTripDatesCommand = {
  type: "shiftTripDates";
  deltaDays?: number;
  deltaMonths?: number;
};

export type AddOverlayOpCommand = AddGroupDayOverrideCommand & { type: "addOverlayOp" };
export type RemoveOverlayOpCommand = RemoveGroupDayOverrideCommand & { type: "removeOverlayOp" };

export type TripCommand =
  | UpdateBasicsCommand
  | AddStayCommand
  | UpdateStayCommand
  | RemoveStayCommand
  | AddTransportLegCommand
  | AddClassifiedTransportLegsCommand
  | UpdateTransportLegCommand
  | RemoveTransportLegCommand
  | PaintDayRangeCommand
  | ClearDayRangeCommand
  | SetDayPlacesCommand
  | AddActivityCommand
  | UpdateActivityCommand
  | RemoveActivityCommand
  | CreateGroupCommand
  | SetGroupInheritModeCommand
  | EnsurePersonalGroupCommand
  | UpdateGroupCommand
  | DeleteGroupCommand
  | ResetGroupFromMainCommand
  | AddGroupDayOverrideCommand
  | RemoveGroupDayOverrideCommand
  | AddBookingDetailsCommand
  | UpdateBookingDetailsCommand
  | SetBookingStatusCommand
  | SetEmergencyInfoCommand
  | SetViewerSettingsCommand
  | SetTripDateRangeCommand
  | ShiftTripDatesCommand;

/** Normalize legacy command type strings to canonical forms. */
export function normalizeCommand(command: { type: string } & Record<string, unknown>): TripCommand {
  switch (command.type) {
    case "addLeg":
      return { ...command, type: "addTransportLeg" } as AddTransportLegCommand;
    case "updateLeg":
      return { ...command, type: "updateTransportLeg" } as UpdateTransportLegCommand;
    case "removeLeg":
      return { ...command, type: "removeTransportLeg" } as RemoveTransportLegCommand;
    case "paintDays":
      return { ...command, type: "paintDayRange" } as PaintDayRangeCommand;
    case "clearDays":
      return { ...command, type: "clearDayRange" } as ClearDayRangeCommand;
    case "addOverlayOp":
      return { ...command, type: "addGroupDayOverride" } as AddGroupDayOverrideCommand;
    case "removeOverlayOp":
      return { ...command, type: "removeGroupDayOverride" } as RemoveGroupDayOverrideCommand;
    default:
      return command as TripCommand;
  }
}
