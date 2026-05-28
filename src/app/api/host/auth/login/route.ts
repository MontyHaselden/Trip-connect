import { NextResponse } from "next/server";
import { z } from "zod";

import { hostApiError } from "@/lib/host/api-errors";
import { authenticateHostAccount } from "@/lib/host/auth";
import { setHostSessionCookie } from "@/lib/auth/host-session";

const BodySchema = z.object({
  email: z.string().trim().email().max(200),
  password: z.string().min(1).max(200),
});

export async function POST(req: Request) {
  try {
    const json = await req.json().catch(() => null);
    const parsed = BodySchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid request." }, { status: 400 });
    }

    const host = await authenticateHostAccount(parsed.data);
    await setHostSessionCookie({ hostId: host.id, activeTripId: null });

    return NextResponse.json({ ok: true, hostId: host.id });
  } catch (err) {
    return hostApiError(err);
  }
}

