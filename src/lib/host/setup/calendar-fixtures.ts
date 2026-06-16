import type {
  AccommodationStayDraft,
  IntercityLegDraft,
  TransportLegDraft,
} from "@/lib/host/wizard/types";
import { newId } from "@/lib/host/wizard/types";
import type { TripSetupState } from "@/lib/host/setup/types";

export const patongBangkokTrip = {
  startDate: "2026-08-20",
  endDate: "2026-09-10",
  departureCity: "",
  returnCity: "",
};

export function patongStay(
  overrides: Partial<AccommodationStayDraft> = {},
): AccommodationStayDraft {
  return {
    id: "patong-stay",
    cityLabel: "Patong",
    stayType: "hotel",
    name: "Royal Paradise Hotel",
    url: null,
    address: null,
    phone: null,
    checkInDate: "2026-08-22",
    checkOutDate: "2026-08-31",
    notes: null,
    isHomestayGroup: false,
    multipleInCity: false,
    ...overrides,
  };
}

export function bangkokStay(
  overrides: Partial<AccommodationStayDraft> = {},
): AccommodationStayDraft {
  return {
    id: "bangkok-stay",
    cityLabel: "Bangkok",
    stayType: "hotel",
    name: "Centre Point Plus",
    url: null,
    address: null,
    phone: null,
    checkInDate: "2026-09-01",
    checkOutDate: "2026-09-05",
    notes: null,
    isHomestayGroup: false,
    multipleInCity: false,
    ...overrides,
  };
}

export const haseldenTripContext = {
  startDate: "2026-08-23",
  endDate: "2026-09-04",
  departureCity: "Christchurch, New Zealand",
  returnCity: "Christchurch, New Zealand",
};

function haseldenPlaneLeg(
  overrides: Partial<TransportLegDraft> & Pick<TransportLegDraft, "fromCity" | "toCity" | "travelDate">,
): TransportLegDraft {
  return {
    id: newId(),
    transportType: "plane",
    bookingStatus: "booked",
    arrivalDate: overrides.travelDate,
    departureTime: null,
    arrivalTime: null,
    fromStation: null,
    toStation: null,
    operator: "Jetstar",
    referenceNumber: null,
    flightNumber: null,
    notes: null,
    ...overrides,
  };
}

export function haseldenOutboundLegs(): TransportLegDraft[] {
  return [
    haseldenPlaneLeg({
      fromCity: "Christchurch Airport (CHC), New Zealand",
      toCity: "Melbourne Airport (MEL), Australia",
      travelDate: "2026-08-23",
      arrivalDate: "2026-08-23",
      departureTime: "08:20",
      arrivalTime: "10:05",
      flightNumber: "JQ 172",
    }),
    haseldenPlaneLeg({
      fromCity: "Melbourne Airport (MEL), Australia",
      toCity: "Phuket International Airport (HKT), Thailand",
      travelDate: "2026-08-23",
      arrivalDate: "2026-08-23",
      departureTime: "14:50",
      arrivalTime: "20:40",
      flightNumber: "JQ 17",
    }),
  ];
}

export function haseldenReturnLegs(): TransportLegDraft[] {
  return [
    haseldenPlaneLeg({
      fromCity: "Suvarnabhumi Airport (BKK), Thailand",
      toCity: "Melbourne Airport (MEL), Australia",
      travelDate: "2026-09-04",
      arrivalDate: "2026-09-05",
      departureTime: "21:40",
      arrivalTime: "09:25",
      flightNumber: "JQ 30",
    }),
    haseldenPlaneLeg({
      fromCity: "Melbourne Airport (MEL), Australia",
      toCity: "Christchurch Airport (CHC), New Zealand",
      travelDate: "2026-09-05",
      arrivalDate: "2026-09-05",
      departureTime: "11:05",
      arrivalTime: "16:25",
      flightNumber: "JQ 171",
    }),
  ];
}

export function haseldenIntercityLeg(): IntercityLegDraft {
  const leg = haseldenPlaneLeg({
    fromCity: "Phuket International Airport (HKT), Thailand",
    toCity: "Don Mueang International Airport (DMK), Thailand",
    travelDate: "2026-08-31",
    arrivalDate: "2026-08-31",
    departureTime: "12:05",
    arrivalTime: "13:25",
    flightNumber: "SL 755",
    operator: "Thai Lion Air",
  });
  return {
    ...leg,
    intercityFromCity: leg.fromCity,
    intercityToCity: leg.toCity,
    originGroupId: "main",
  };
}

export function haseldenStays(): AccommodationStayDraft[] {
  return [
    patongStay({
      checkInDate: "2026-08-23",
      checkOutDate: "2026-08-31",
      name: "The Royal Paradise Hotel & Spa",
    }),
    bangkokStay({
      checkInDate: "2026-08-31",
      checkOutDate: "2026-09-04",
      name: "Centre Point Plus Hotel Silom",
    }),
  ];
}

export function haseldenAug2026State(): TripSetupState {
  return {
    basics: {
      name: "Haselden Thailand",
      schoolName: "Test",
      startDate: haseldenTripContext.startDate,
      endDate: haseldenTripContext.endDate,
      timezone: "Asia/Bangkok",
      departureCity: haseldenTripContext.departureCity,
      returnCity: haseldenTripContext.returnCity,
      defaultDepartureAirport: "Christchurch Airport (CHC)",
      destinationCountries: ["Thailand"],
    },
    mainGroupId: "main",
    groups: [{ id: "main", name: "Everyone", type: "main", description: null, sortOrder: 0, isMain: true }],
    dayPlacesByGroupId: { main: [] },
    outboundLegs: haseldenOutboundLegs(),
    returnLegs: haseldenReturnLegs(),
    intercityLegs: [haseldenIntercityLeg()],
    accommodationStays: haseldenStays(),
    activities: [],
    overlayOps: [],
  };
}

export function patongBangkokLeg(): IntercityLegDraft {
  return {
    id: "leg-1",
    transportType: "plane",
    fromCity: "Patong",
    toCity: "Bangkok",
    travelDate: "2026-08-31",
    arrivalDate: null,
    departureTime: null,
    arrivalTime: null,
    fromStation: null,
    toStation: null,
    operator: null,
    referenceNumber: null,
    intercityFromCity: "Patong",
    intercityToCity: "Bangkok",
    legKind: "city_change",
    bookingStatus: "not_booked",
    flightNumber: null,
    notes: null,
  };
}
