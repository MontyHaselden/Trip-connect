import { NextResponse } from "next/server";
import { z } from "zod";

import { hostApiError } from "@/lib/host/api-errors";
import { enterTripApp } from "@/lib/host/enter-app";

const BodySchema = z.object({
  inviteCode: z.string().trim().min(2).max(20),
});

export async function POST(req: Request) {
  try {
    const json = await req.json().catch(() => null);
    const parsed = BodySchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid request." }, { status: 400 });
    }

    const result = await enterTripApp(parsed.data.inviteCode);
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    return hostApiError(err);
  }
}
