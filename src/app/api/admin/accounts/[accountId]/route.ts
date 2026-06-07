import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";

import { logAdminAction } from "@/lib/admin/audit";
import { adminApiError } from "@/lib/admin/api-errors";
import { canEditBilling, requireAdminRole } from "@/lib/admin/permissions";
import { getAccountUsage } from "@/lib/admin/stats";
import { listInvoices } from "@/lib/billing/invoices";
import {
  changeAccountPlan,
  getSubscriptionForAccount,
} from "@/lib/billing/subscriptions";
import { db } from "@/lib/db/client";
import {
  adminAuditLog,
  hostAccounts,
  hostTripMembers,
  invoices,
  payshareSessions,
  trips,
} from "@/lib/db/schema";
import type { SubscriptionPlan } from "@/lib/plans/plan-config";

const PatchSchema = z.object({
  plan: z.string().optional(),
  foundingSchool: z.boolean().optional(),
  paused: z.boolean().optional(),
  internalNotes: z.string().nullable().optional(),
  overrideAiBuilder: z.boolean().nullable().optional(),
  overrideViewerLinks: z.boolean().nullable().optional(),
  overridePhotoGallery: z.boolean().nullable().optional(),
  overrideActiveTripLimit: z.number().int().nullable().optional(),
  overrideStaffLimit: z.number().int().nullable().optional(),
  billingContactName: z.string().nullable().optional(),
  billingEmail: z.string().nullable().optional(),
  billingAddress: z.string().nullable().optional(),
});

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ accountId: string }> },
) {
  try {
    await requireAdminRole("support");
    const { accountId } = await ctx.params;

    const account = await db
      .select()
      .from(hostAccounts)
      .where(eq(hostAccounts.id, accountId))
      .limit(1)
      .then((rows) => rows[0] ?? null);
    if (!account) {
      return NextResponse.json({ error: "Not found." }, { status: 404 });
    }

    const sub = await getSubscriptionForAccount(accountId);
    const usage = await getAccountUsage(accountId);

    const tripRows = await db
      .select({
        id: trips.id,
        name: trips.name,
        startDate: trips.startDate,
        endDate: trips.endDate,
        publishedVersion: trips.publishedVersion,
      })
      .from(trips)
      .innerJoin(hostTripMembers, eq(hostTripMembers.tripId, trips.id))
      .where(eq(hostTripMembers.hostId, accountId));

    const accountInvoices = await db
      .select()
      .from(invoices)
      .where(eq(invoices.accountId, accountId))
      .orderBy(invoices.createdAt);

    const sessions = await db
      .select()
      .from(payshareSessions)
      .where(eq(payshareSessions.accountId, accountId));

    const audit = await db
      .select()
      .from(adminAuditLog)
      .where(eq(adminAuditLog.entityId, accountId))
      .limit(20);

    return NextResponse.json({
      account,
      subscription: sub,
      usage,
      trips: tripRows,
      invoices: accountInvoices,
      payshareSessions: sessions,
      audit,
    });
  } catch (err) {
    return adminApiError(err);
  }
}

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ accountId: string }> },
) {
  try {
    const admin = await requireAdminRole("admin");
    const { accountId } = await ctx.params;

    const json = await req.json().catch(() => null);
    const parsed = PatchSchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid request." }, { status: 400 });
    }

    const before = await db
      .select()
      .from(hostAccounts)
      .where(eq(hostAccounts.id, accountId))
      .limit(1)
      .then((rows) => rows[0] ?? null);
    if (!before) {
      return NextResponse.json({ error: "Not found." }, { status: 404 });
    }

    const updates: Record<string, unknown> = { updatedAt: new Date() };
    const data = parsed.data;

    if (data.plan && canEditBilling(admin.role)) {
      await changeAccountPlan({
        accountId,
        planCode: data.plan as SubscriptionPlan,
        adminId: admin.id,
      });
      updates.plan = data.plan;
    }
    if (data.foundingSchool !== undefined) updates.foundingSchool = data.foundingSchool;
    if (data.paused !== undefined) {
      updates.pausedAt = data.paused ? new Date() : null;
    }
    if (data.internalNotes !== undefined) updates.internalNotes = data.internalNotes;
    if (data.overrideAiBuilder !== undefined) updates.overrideAiBuilder = data.overrideAiBuilder;
    if (data.overrideViewerLinks !== undefined) updates.overrideViewerLinks = data.overrideViewerLinks;
    if (data.overridePhotoGallery !== undefined) updates.overridePhotoGallery = data.overridePhotoGallery;
    if (data.overrideActiveTripLimit !== undefined) updates.overrideActiveTripLimit = data.overrideActiveTripLimit;
    if (data.overrideStaffLimit !== undefined) updates.overrideStaffLimit = data.overrideStaffLimit;
    if (data.billingContactName !== undefined) updates.billingContactName = data.billingContactName;
    if (data.billingEmail !== undefined) updates.billingEmail = data.billingEmail;
    if (data.billingAddress !== undefined) updates.billingAddress = data.billingAddress;

    const [after] = await db
      .update(hostAccounts)
      .set(updates)
      .where(eq(hostAccounts.id, accountId))
      .returning();

    await logAdminAction({
      adminId: admin.id,
      action: "account.update",
      entityType: "host_account",
      entityId: accountId,
      before,
      after,
      req,
    });

    return NextResponse.json({ ok: true, account: after });
  } catch (err) {
    return adminApiError(err);
  }
}
