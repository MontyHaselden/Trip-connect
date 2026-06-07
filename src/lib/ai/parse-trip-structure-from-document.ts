import { z } from "zod";

import { completeOpenAiJson, parseOpenAiJsonContent } from "@/lib/ai/openai-json";
import {
  buildDocumentImportUserMessage,
  documentImportSystemRules,
} from "@/lib/documents/document-import-instructions";
import { prepareDocumentForAi } from "@/lib/documents/prepare-for-ai";
import {
  BOOKING_STATUSES,
  DAY_TYPES,
  STAY_TYPES,
  TRANSPORT_TYPES,
  newId,
} from "@/lib/host/wizard/types";
import type {
  AccommodationStayDraft,
  DayPlaceDraft,
  IntercityLegDraft,
  TransportLegDraft,
} from "@/lib/host/wizard/types";

const DayPlaceSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  primaryCity: z.string(),
  secondaryCity: z.string().nullable().optional(),
  primaryShare: z.number().min(0).max(1).optional(),
  dayType: z.enum(DAY_TYPES).optional(),
});

const TransportLegSchema = z.object({
  transportType: z.enum(TRANSPORT_TYPES),
  bookingStatus: z.enum(BOOKING_STATUSES).optional(),
  travelDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  arrivalDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  departureTime: z.string().nullable().optional(),
  arrivalTime: z.string().nullable().optional(),
  fromCity: z.string(),
  toCity: z.string(),
  fromStation: z.string().nullable().optional(),
  toStation: z.string().nullable().optional(),
  operator: z.string().nullable().optional(),
  referenceNumber: z.string().nullable().optional(),
  flightNumber: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
});

const IntercityLegSchema = TransportLegSchema.extend({
  intercityFromCity: z.string(),
  intercityToCity: z.string(),
});

const StaySchema = z.object({
  cityLabel: z.string().min(1),
  stayType: z.enum(STAY_TYPES).optional(),
  name: z.string().nullable().optional(),
  url: z.string().nullable().optional(),
  address: z.string().nullable().optional(),
  phone: z.string().nullable().optional(),
  checkInDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  checkOutDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  notes: z.string().nullable().optional(),
});

const TripStructureSchema = z.object({
  departureCity: z.string().optional(),
  returnCity: z.string().optional(),
  dayPlaces: z.array(DayPlaceSchema).optional(),
  outboundLegs: z.array(TransportLegSchema).optional(),
  returnLegs: z.array(TransportLegSchema).optional(),
  intercityLegs: z.array(IntercityLegSchema).optional(),
  accommodationStays: z.array(StaySchema).optional(),
});

export type TripStructureResult = {
  departureCity: string | null;
  returnCity: string | null;
  dayPlaces: DayPlaceDraft[];
  outboundLegs: TransportLegDraft[];
  returnLegs: TransportLegDraft[];
  intercityLegs: IntercityLegDraft[];
  accommodationStays: AccommodationStayDraft[];
};

function toTransportLeg(raw: z.infer<typeof TransportLegSchema>): TransportLegDraft {
  return {
    id: newId(),
    transportType: raw.transportType,
    bookingStatus: raw.bookingStatus ?? "not_booked",
    travelDate: raw.travelDate,
    arrivalDate: raw.arrivalDate ?? null,
    departureTime: raw.departureTime ?? null,
    arrivalTime: raw.arrivalTime ?? null,
    fromCity: raw.fromCity,
    toCity: raw.toCity,
    fromStation: raw.fromStation ?? null,
    toStation: raw.toStation ?? null,
    operator: raw.operator ?? null,
    referenceNumber: raw.referenceNumber ?? null,
    flightNumber: raw.flightNumber ?? null,
    notes: raw.notes ?? null,
  };
}

export async function parseTripStructureFromDocument(params: {
  text: string;
  startDate: string;
  endDate: string;
  defaultTimezone: string;
  departureCity?: string;
  returnCity?: string;
  instructions?: string | null;
}): Promise<TripStructureResult> {
  const trimmed = prepareDocumentForAi(params.text);
  if (trimmed.length < 50) {
    throw new Error("The document did not contain enough itinerary text.");
  }

  const system = `You extract trip structure (transport, day locations, hotels) from school trip documents into JSON.

Return ONLY valid JSON:
{
  "departureCity": "string",
  "returnCity": "string",
  "dayPlaces": [{"date":"YYYY-MM-DD","primaryCity":"string","secondaryCity":null,"primaryShare":1,"dayType":"trip"}],
  "outboundLegs": [{"transportType":"plane","travelDate":"YYYY-MM-DD","fromCity":"","toCity":"","flightNumber":null,...}],
  "returnLegs": [...],
  "intercityLegs": [{"intercityFromCity":"","intercityToCity":"","transportType":"train","travelDate":"YYYY-MM-DD",...}],
  "accommodationStays": [{"cityLabel":"","name":null,"checkInDate":"YYYY-MM-DD","checkOutDate":"YYYY-MM-DD","stayType":"hotel"}]
}

Rules:
- Trip runs ${params.startDate} to ${params.endDate}.
- dayPlaces: one entry per calendar day in the trip (and buffer days if flights depart/arrive outside). Use dayType "travel" when the group moves between cities that day; set secondaryCity to the arrival city and primaryShare ~0.25–0.5 when split.
- outboundLegs: flights from home to destination on or before start date.
- returnLegs: flights home on or after end date.
- intercityLegs: each distinct city change during the trip (train, bus, plane, etc.).
- accommodationStays: hotels/hostels with check-in/out covering nights in each city. Use real hotel names when stated.
- bookingStatus: "booked" only when clearly confirmed; otherwise "not_booked".
- Do NOT include activity items.
- ${documentImportSystemRules({ defaultTimezone: params.defaultTimezone })}
- No markdown or commentary.`;

  const userContent = buildDocumentImportUserMessage({
    documentText: trimmed,
    instructions: params.instructions,
  });

  const content = await completeOpenAiJson({ system, user: userContent });
  const parsed = parseOpenAiJsonContent(content);
  const validated = TripStructureSchema.safeParse(parsed);
  if (!validated.success) {
    throw new Error("AI could not read trip structure from that document.");
  }

  const data = validated.data;

  return {
    departureCity: data.departureCity?.trim() || params.departureCity || null,
    returnCity: data.returnCity?.trim() || params.returnCity || null,
    dayPlaces: (data.dayPlaces ?? []).map((d) => ({
      date: d.date,
      primaryCity: d.primaryCity,
      secondaryCity: d.secondaryCity ?? null,
      primaryShare: d.primaryShare ?? 1,
      dayType: d.dayType ?? "trip",
      includeBuffer: false,
    })),
    outboundLegs: (data.outboundLegs ?? []).map(toTransportLeg),
    returnLegs: (data.returnLegs ?? []).map(toTransportLeg),
    intercityLegs: (data.intercityLegs ?? []).map((l) => {
      const base = toTransportLeg(l);
      return {
        ...base,
        intercityFromCity: l.intercityFromCity,
        intercityToCity: l.intercityToCity,
      };
    }),
    accommodationStays: (data.accommodationStays ?? []).map((s) => ({
      id: newId(),
      cityLabel: s.cityLabel,
      stayType: s.stayType ?? "hotel",
      name: s.name ?? null,
      url: s.url ?? null,
      address: s.address ?? null,
      phone: s.phone ?? null,
      checkInDate: s.checkInDate,
      checkOutDate: s.checkOutDate,
      notes: s.notes ?? null,
      isHomestayGroup: false,
      multipleInCity: false,
    })),
  };
}
