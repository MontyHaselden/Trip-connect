import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";

import { db } from "@/lib/db/client";
import { contacts } from "@/lib/db/schema";
import { requireHostTripForInvite } from "@/lib/auth/require-host-trip";
import { hostApiError } from "@/lib/host/api-errors";
import {
  getContactForTrip,
  setEmergencyLead,
} from "@/lib/host/contacts-queries";
import { normalizeToE164 } from "@/lib/utils/phone";
import { maybeAutoPublish } from "@/lib/publish/maybe-auto-publish";

const PatchContactSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  role: z.string().trim().min(1).max(100).optional(),
  phoneNumber: z.string().trim().min(3).max(40).optional(),
  visibility: z.enum(["students", "hosts_only"]).optional(),
  isEmergencyLead: z.boolean().optional(),
  sortOrder: z.number().int().min(0).optional(),
});

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ inviteCode: string; contactId: string }> },
) {
  const { inviteCode, contactId } = await ctx.params;
  try {
    const trip = await requireHostTripForInvite(inviteCode);
    const existing = await getContactForTrip(trip.id, contactId);
    if (!existing) {
      return NextResponse.json({ error: "Contact not found." }, { status: 404 });
    }

    const json = await req.json().catch(() => null);
    const parsed = PatchContactSchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid request." }, { status: 400 });
    }

    let phoneNumber = existing.phoneNumber;
    if (parsed.data.phoneNumber) {
      phoneNumber = normalizeToE164(
        parsed.data.phoneNumber,
        trip.defaultCountryCallingCode,
      );
    }

    const isEmergencyLead =
      parsed.data.isEmergencyLead !== undefined
        ? parsed.data.isEmergencyLead
        : existing.isEmergencyLead;

    if (isEmergencyLead) {
      await setEmergencyLead(trip.id, contactId);
    }

    const [updated] = await db
      .update(contacts)
      .set({
        name: parsed.data.name ?? existing.name,
        role: parsed.data.role ?? existing.role,
        phoneNumber,
        visibility: parsed.data.visibility ?? existing.visibility,
        isEmergencyLead,
        sortOrder: parsed.data.sortOrder ?? existing.sortOrder,
      })
      .where(eq(contacts.id, contactId))
      .returning();

    await maybeAutoPublish(trip.id);
    return NextResponse.json(updated);
  } catch (err) {
    return hostApiError(err);
  }
}

export async function DELETE(
  _req: Request,
  ctx: { params: Promise<{ inviteCode: string; contactId: string }> },
) {
  const { inviteCode, contactId } = await ctx.params;
  try {
    const trip = await requireHostTripForInvite(inviteCode);
    const existing = await getContactForTrip(trip.id, contactId);
    if (!existing) {
      return NextResponse.json({ error: "Contact not found." }, { status: 404 });
    }

    await db.delete(contacts).where(eq(contacts.id, contactId));
    await maybeAutoPublish(trip.id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return hostApiError(err);
  }
}
