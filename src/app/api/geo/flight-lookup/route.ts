import { NextResponse } from "next/server";
import { z } from "zod";

import {
  lookupFlight,
  lookupFlightCandidatesInWindow,
} from "@/lib/host/wizard/lookup-flight";

export const runtime = "nodejs";

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

const QuerySchema = z.object({
  flight: z.string().trim().min(2).max(16),
  date: isoDate.optional(),
  from: isoDate.optional(),
  to: isoDate.optional(),
});

export async function GET(req: Request) {
  if (!process.env.AERODATABOX_API_KEY?.trim()) {
    return NextResponse.json(
      {
        error:
          "Flight lookup is not configured. Add AERODATABOX_API_KEY to your environment.",
      },
      { status: 503 },
    );
  }

  const url = new URL(req.url);
  const parsed = QuerySchema.safeParse({
    flight: url.searchParams.get("flight") ?? "",
    date: url.searchParams.get("date") ?? undefined,
    from: url.searchParams.get("from") ?? undefined,
    to: url.searchParams.get("to") ?? undefined,
  });

  if (!parsed.success) {
    return NextResponse.json({ error: "Enter a valid flight number." }, { status: 400 });
  }

  try {
    if (parsed.data.from && parsed.data.to) {
      const flights = await lookupFlightCandidatesInWindow(parsed.data.flight, {
        from: parsed.data.from,
        to: parsed.data.to,
      });

      if (!flights.length) {
        return NextResponse.json(
          {
            error:
              "No flight schedule found in that date range. Check the flight code or enter route details manually.",
          },
          { status: 404 },
        );
      }

      return NextResponse.json({ flights });
    }

    const result = await lookupFlight(parsed.data.flight, {
      travelDate: parsed.data.date,
    });

    if (!result) {
      return NextResponse.json(
        {
          error:
            "No flight schedule found for that number. Check the flight code or enter route details manually.",
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
