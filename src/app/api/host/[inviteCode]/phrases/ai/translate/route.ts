import { NextResponse } from "next/server";
import { z } from "zod";

import { requireHostTripEditAccess } from "@/lib/auth/require-host-trip";
import { translatePhrase } from "@/lib/ai/phrase-translate";
import { hostApiError } from "@/lib/host/api-errors";

const BodySchema = z.object({
  englishText: z.string().trim().min(1).max(500),
});

export async function POST(
  req: Request,
  ctx: { params: Promise<{ inviteCode: string }> },
) {
  const { inviteCode } = await ctx.params;
  try {
    const trip = await requireHostTripEditAccess(inviteCode);
    const json = await req.json().catch(() => null);
    const parsed = BodySchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid request." }, { status: 400 });
    }

    try {
      const result = await translatePhrase({
        englishText: parsed.data.englishText,
        context: {
          destinationLanguage: trip.destinationLanguage ?? "",
          destinationCountry: trip.destinationCountry,
          tripName: trip.name,
        },
      });
      return NextResponse.json(result);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Translation failed.";
      if (msg.includes("OPENAI_API_KEY") || msg.includes("destination language")) {
        const status = msg.includes("OPENAI_API_KEY") ? 503 : 400;
        return NextResponse.json({ error: msg }, { status });
      }
      return NextResponse.json({ error: msg }, { status: 400 });
    }
  } catch (err) {
    return hostApiError(err);
  }
}
