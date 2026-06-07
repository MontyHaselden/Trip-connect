import { NextResponse } from "next/server";
import { z } from "zod";

import { searchAirports } from "@/lib/geo/airports";

export const runtime = "nodejs";

const QuerySchema = z.object({
  q: z.string().trim().min(3).max(120),
  countries: z.string().optional(),
});

export async function GET(req: Request) {
  const url = new URL(req.url);
  const parsed = QuerySchema.safeParse({
    q: url.searchParams.get("q") ?? "",
    countries: url.searchParams.get("countries") ?? undefined,
  });

  if (!parsed.success) {
    return NextResponse.json({ suggestions: [] });
  }

  const countryCodes = parsed.data.countries
    ? parsed.data.countries.split(",").filter(Boolean)
    : undefined;

  const suggestions = await searchAirports({
    query: parsed.data.q,
    countryCodes,
    limit: 8,
  });

  return NextResponse.json({ suggestions });
}
