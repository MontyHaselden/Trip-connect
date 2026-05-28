import { NextResponse } from "next/server";
import { z } from "zod";

import { hostApiError } from "@/lib/host/api-errors";
import { createHostAccount } from "@/lib/host/auth";
import { setHostSessionCookie } from "@/lib/auth/host-session";

const BodySchema = z.object({
  email: z.string().trim().email().max(200),
  phoneNumber: z.string().trim().min(3).max(40),
  defaultCountryCallingCode: z.string().trim().min(2).max(2),
  password: z.string().min(8).max(200),
  fullName: z.string().trim().min(2).max(120),
  role: z.enum(["teacher", "helper", "host", "admin"]),
});

export async function POST(req: Request) {
  try {
    const json = await req.json().catch(() => null);
    const parsed = BodySchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid request." }, { status: 400 });
    }

    const host = await createHostAccount(parsed.data);
    await setHostSessionCookie({ hostId: host.id, activeTripId: null });

    return NextResponse.json({ ok: true, hostId: host.id });
  } catch (err) {
    return hostApiError(err);
  }
}

