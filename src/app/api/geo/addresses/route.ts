import { NextResponse } from "next/server";
import { z } from "zod";

import { searchAddresses } from "@/lib/geo/address-search";
import { getGooglePlaceDetails } from "@/lib/geo/google-places";

export const runtime = "nodejs";

const SearchSchema = z.object({
  q: z.string().trim().min(2).max(160),
  countries: z.string().optional(),
  city: z.string().trim().max(120).optional(),
  lodging: z.enum(["1", "true"]).optional(),
});

const DetailsSchema = z.object({
  placeId: z.string().trim().min(1).max(256),
});

export async function GET(req: Request) {
  const url = new URL(req.url);
  const placeId = url.searchParams.get("placeId");

  if (placeId) {
    const parsed = DetailsSchema.safeParse({ placeId });
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid place id" }, { status: 400 });
    }

    const details = await getGooglePlaceDetails(parsed.data.placeId);
    if (!details) {
      return NextResponse.json({ error: "Place not found" }, { status: 404 });
    }

    return NextResponse.json(details);
  }

  const parsed = SearchSchema.safeParse({
    q: url.searchParams.get("q") ?? "",
    countries: url.searchParams.get("countries") ?? undefined,
    city: url.searchParams.get("city") ?? undefined,
    lodging: url.searchParams.get("lodging") ?? undefined,
  });

  if (!parsed.success) {
    return NextResponse.json({ suggestions: [] });
  }

  const countryCodes = parsed.data.countries
    ? parsed.data.countries.split(",").filter(Boolean)
    : undefined;

  const suggestions = await searchAddresses({
    query: parsed.data.q,
    countryCodes,
    cityHint: parsed.data.city,
    lodgingOnly: parsed.data.lodging === "1" || parsed.data.lodging === "true",
    limit: 10,
  });

  return NextResponse.json({ suggestions });
}
