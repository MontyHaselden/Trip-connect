import type {
  AccommodationStayDraft,
  DayPlaceDraft,
  IntercityLegDraft,
  TransportLegDraft,
  WizardBasics,
} from "@/lib/host/wizard/types";

export type TripLocationBasics = Pick<
  WizardBasics,
  | "name"
  | "schoolName"
  | "startDate"
  | "endDate"
  | "timezone"
  | "departureCity"
  | "returnCity"
  | "defaultDepartureAirport"
  | "destinationCountries"
>;

export type TripLocationState = {
  basics: TripLocationBasics;
  dayPlaces: DayPlaceDraft[];
  outboundLegs: TransportLegDraft[];
  returnLegs: TransportLegDraft[];
  intercityLegs: IntercityLegDraft[];
  accommodationStays: AccommodationStayDraft[];
};
