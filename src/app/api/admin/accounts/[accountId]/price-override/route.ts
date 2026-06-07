import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";

import { logAdminAction } from "@/lib/admin/audit";
import { adminApiError } from "@/lib/admin/api-errors";
import { canEditBilling, requireAdminRole } from "@/lib/admin/permissions";
import { db } from "@/lib/db/client";
import { priceOverrides, subscriptions } from "@/lib/db/schema";
import { calcGstAmount } from "@/lib/billing/gst";
import { getGstSettings } from "@/lib/billing/settings";

const BodySchema = z.object({
  basePriceCents: z.number().int().min(0),
  reason: z.string().optional(),
  internalNotes: z.string().optional(),
  lockedPrice: z.boolean().optional(),
  endsAt: z.string().datetime().optional().nullable(),
});

export async function POST(
  req: Request,
  ctx: { params: Promise<{ accountId: string }> },
) {
  try {
    const admin = await requireAdminRole("admin");
    if (!canEditBilling(admin.role)) {
      return NextResponse.json({ error: "Forbidden." }, { status: 403 });
    }

    const { accountId } = await ctx.params;
    const json = await req.json().catch(() => null);
    const parsed = BodySchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid request." }, { status: 400 });
    }

    const [override] = await db
      .insert(priceOverrides)
      .values({
        accountId,
        basePriceCents: parsed.data.basePriceCents,
        reason: parsed.data.reason ?? null,
        internalNotes: parsed.data.internalNotes ?? null,
        lockedPrice: parsed.data.lockedPrice ?? false,
        endsAt: parsed.data.endsAt ? new Date(parsed.data.endsAt) : null,
        createdByAdminId: admin.id,
      })
      .returning();

    const gst = await getGstSettings();
    const gstAmountCents = gst.gstEnabled
      ? calcGstAmount(parsed.data.basePriceCents, gst.gstRate)
      : 0;
    const totalCents = parsed.data.basePriceCents + gstAmountCents;

    await db
      .update(subscriptions)
      .set({
        priceOverrideId: override.id,
        basePriceCents: parsed.data.basePriceCents,
        gstAmountCents,
        totalCents,
        updatedAt: new Date(),
      })
      .where(eq(subscriptions.accountId, accountId));

    await logAdminAction({
      adminId: admin.id,
      action: "price_override.create",
      entityType: "host_account",
      entityId: accountId,
      after: override,
      req,
    });

    return NextResponse.json({ ok: true, override });
  } catch (err) {
    return adminApiError(err);
  }
}
