import { NextResponse } from "next/server";
import { z } from "zod";

import { resolveFlightForTrip } from "@/lib/host/setup/resolve-flight-for-trip";

export const runtime = "nodejs";

const BodySchema = z.object({
  flight: z.string().trim().min(2).max(16),
  departureDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

export async function POST(req: Request) {
  if (!process.env.AERODATABOX_API_KEY?.trim()) {
    return NextResponse.json(
      {
        error:
          "Flight lookup is not configured. Add AERODATABOX_API_KEY to your environment.",
      },
      { status: 503 },
    );
  }

  const body = await req.json().catch(() => null);
  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Enter a flight number and departure date." },
      { status: 400 },
    );
  }

  try {
    const result = await resolveFlightForTrip(
      parsed.data.flight,
      parsed.data.departureDate,
    );

    if (!result) {
      return NextResponse.json(
        {
          error:
            "No schedule found for that flight on that departure date. Check the number and date.",
        },
        { status: 404 },
      );
    }

    return NextResponse.json({ flight: result });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Flight lookup failed";
    const status =
      message.includes("AeroDataBox request failed (401)") ||
      message.includes("AeroDataBox request failed (403)")
        ? 403
        : message.includes("AeroDataBox request failed (429)")
          ? 429
          : 502;
    return NextResponse.json({ error: message }, { status });
  }
}
