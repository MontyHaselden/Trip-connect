import { NextResponse } from "next/server";
import { z } from "zod";

import {
  buildTimezoneDisplay,
  inferTripTimezone,
} from "@/lib/geo/resolve-timezone";

export const runtime = "nodejs";

const BodySchema = z.object({
  countries: z.array(z.string()).optional(),
  cities: z.array(z.string()).optional(),
  departureCity: z.string().optional(),
});

export async function POST(req: Request) {
  const json = await req.json().catch(() => null);
  const parsed = BodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const iana = await inferTripTimezone(parsed.data);
  const display = buildTimezoneDisplay(iana);

  return NextResponse.json({
    timezone: iana,
    display,
  });
}
