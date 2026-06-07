import { NextResponse } from "next/server";
import { z } from "zod";

import { requireHostSessionHostId } from "@/lib/auth/host-session";
import { hostApiError } from "@/lib/host/api-errors";
import { getTripByIdForHost } from "@/lib/host/get-trip-by-id";
import { applyTripLocationState } from "@/lib/host/locations/apply-location-state";
import {
  loadTripLocationState,
  normalizeLocationStateIds,
} from "@/lib/host/locations/trip-location-state";
import {
  BOOKING_STATUSES,
  DAY_TYPES,
  STAY_TYPES,
  TRANSPORT_TYPES,
} from "@/lib/host/wizard/types";

const DayPlaceSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  primaryCity: z.string(),
  secondaryCity: z.string().nullable(),
  primaryShare: z.number().min(0).max(1),
  dayType: z.enum(DAY_TYPES),
  includeBuffer: z.boolean(),
});

const TransportLegSchema = z.object({
  id: z.string().uuid(),
  transportType: z.enum(TRANSPORT_TYPES),
  bookingStatus: z.enum(BOOKING_STATUSES),
  travelDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  arrivalDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
  departureTime: z.string().nullable(),
  arrivalTime: z.string().nullable(),
  fromCity: z.string(),
  toCity: z.string(),
  fromStation: z.string().nullable(),
  toStation: z.string().nullable(),
  operator: z.string().nullable(),
  referenceNumber: z.string().nullable(),
  flightNumber: z.string().nullable(),
  notes: z.string().nullable(),
});

const IntercityLegSchema = TransportLegSchema.extend({
  intercityFromCity: z.string(),
  intercityToCity: z.string(),
  legKind: z.enum(["city_change", "airport_arrival", "airport_departure"]).optional(),
  anchorLegId: z.string().uuid().nullable().optional(),
});

const StaySchema = z.object({
  id: z.string().uuid(),
  cityLabel: z.string().min(1),
  stayType: z.enum(STAY_TYPES),
  name: z.string().nullable(),
  url: z.string().nullable(),
  address: z.string().nullable(),
  phone: z.string().nullable(),
  checkInDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  checkOutDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  notes: z.string().nullable(),
  isHomestayGroup: z.boolean(),
  multipleInCity: z.boolean(),
});

const LocationStateSchema = z.object({
  basics: z.object({
    name: z.string().min(1),
    schoolName: z.string(),
    startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    timezone: z.string(),
    departureCity: z.string(),
    returnCity: z.string(),
    destinationCountries: z.array(z.string()),
  }),
  dayPlaces: z.array(DayPlaceSchema),
  outboundLegs: z.array(TransportLegSchema),
  returnLegs: z.array(TransportLegSchema),
  intercityLegs: z.array(IntercityLegSchema),
  accommodationStays: z.array(StaySchema),
});

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ tripId: string }> },
) {
  const { tripId } = await ctx.params;
  try {
    const hostId = await requireHostSessionHostId();
    const trip = await getTripByIdForHost(hostId, tripId);
    if (!trip) return NextResponse.json({ error: "Trip not found." }, { status: 404 });

    const state = await loadTripLocationState(tripId);
    if (!state) return NextResponse.json({ error: "Trip not found." }, { status: 404 });

    return NextResponse.json({ state });
  } catch (err) {
    return hostApiError(err);
  }
}

export async function PUT(
  req: Request,
  ctx: { params: Promise<{ tripId: string }> },
) {
  const { tripId } = await ctx.params;
  try {
    const hostId = await requireHostSessionHostId();
    const trip = await getTripByIdForHost(hostId, tripId);
    if (!trip) return NextResponse.json({ error: "Trip not found." }, { status: 404 });

    const json = await req.json().catch(() => null);
    const parsed = LocationStateSchema.safeParse(json?.state ?? json);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid location data." }, { status: 400 });
    }

    const state = normalizeLocationStateIds(parsed.data);
    const result = await applyTripLocationState(tripId, state);

    return NextResponse.json({ ok: true, dayCount: result.dayCount });
  } catch (err) {
    return hostApiError(err);
  }
}
