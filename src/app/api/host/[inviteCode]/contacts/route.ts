import { NextResponse } from "next/server";
import { z } from "zod";

import { db } from "@/lib/db/client";
import { contacts } from "@/lib/db/schema";
import {
  requireHostTripEditAccess,
  requireHostTripForInvite,
} from "@/lib/auth/require-host-trip";
import { hostApiError } from "@/lib/host/api-errors";
import {
  clearEmergencyLeadExcept,
  loadContacts,
  nextContactSortOrder,
} from "@/lib/host/contacts-queries";
import { normalizeToE164 } from "@/lib/utils/phone";
import { maybeAutoPublish } from "@/lib/publish/maybe-auto-publish";

const CreateContactSchema = z.object({
  name: z.string().trim().min(1).max(120),
  role: z.string().trim().min(1).max(100),
  phoneNumber: z.string().trim().min(3).max(40),
  visibility: z.enum(["students", "hosts_only"]),
  isEmergencyLead: z.boolean().optional(),
});

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ inviteCode: string }> },
) {
  const { inviteCode } = await ctx.params;
  try {
    const trip = await requireHostTripForInvite(inviteCode);
    const list = await loadContacts(trip.id);
    return NextResponse.json({ contacts: list });
  } catch (err) {
    return hostApiError(err);
  }
}

export async function POST(
  req: Request,
  ctx: { params: Promise<{ inviteCode: string }> },
) {
  const { inviteCode } = await ctx.params;
  try {
    const trip = await requireHostTripEditAccess(inviteCode);
    const json = await req.json().catch(() => null);
    const parsed = CreateContactSchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid request." }, { status: 400 });
    }

    const phoneE164 = normalizeToE164(
      parsed.data.phoneNumber,
      trip.defaultCountryCallingCode,
    );
    const sortOrder = await nextContactSortOrder(trip.id);
    const isEmergencyLead = parsed.data.isEmergencyLead ?? false;

    if (isEmergencyLead) {
      await clearEmergencyLeadExcept(trip.id);
    }

    const [created] = await db
      .insert(contacts)
      .values({
        tripId: trip.id,
        name: parsed.data.name,
        role: parsed.data.role,
        phoneNumber: phoneE164,
        visibility: parsed.data.visibility,
        sortOrder,
        isEmergencyLead,
      })
      .returning();

    await maybeAutoPublish(trip.id);
    return NextResponse.json(created);
  } catch (err) {
    return hostApiError(err);
  }
}
