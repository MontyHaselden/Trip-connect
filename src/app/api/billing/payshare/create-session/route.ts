import { NextResponse } from "next/server";
import { z } from "zod";

import { getGstSettings } from "@/lib/billing/settings";
import { getPlanByCode } from "@/lib/billing/subscriptions";
import { getHostSession } from "@/lib/auth/host-session";
import { db } from "@/lib/db/client";
import { payshareSessions } from "@/lib/db/schema";
import { getHostAccountById } from "@/lib/host/auth";

const BodySchema = z.object({
  plan: z.literal("personal_one_time").optional(),
});

export async function POST(req: Request) {
  const session = await getHostSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const account = await getHostAccountById(session.hostId);
  if (!account || account.accountType !== "personal") {
    return NextResponse.json({ error: "PayShare is for personal one-time trips." }, { status: 400 });
  }

  const json = await req.json().catch(() => ({}));
  const parsed = BodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const plan = await getPlanByCode("personal_one_time");
  const gst = await getGstSettings();
  const amountCents = plan?.basePriceCents ?? 1800;
  const groupSize = plan?.groupSizeLimit ?? 6;
  const splitAmountCents = Math.ceil(amountCents / groupSize);
  const sessionId = `payshare_${session.hostId.slice(0, 8)}_${Date.now()}`;
  const checkoutUrl = `/payshare?session=${sessionId}`;
  const expiresAt = new Date();
  expiresAt.setHours(expiresAt.getHours() + 24);

  await db.insert(payshareSessions).values({
    accountId: session.hostId,
    planId: plan?.id ?? null,
    sessionId,
    amountCents,
    splitAmountCents,
    groupSize,
    checkoutUrl,
    expiresAt,
  });

  return NextResponse.json({
    ok: true,
    sessionId,
    amountCents,
    splitAmountCents,
    groupSize,
    checkoutUrl,
    message: "PayShare session created. Real PayShare API integration coming later.",
  });
}
