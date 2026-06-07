import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";

import { logAdminAction } from "@/lib/admin/audit";
import { adminApiError } from "@/lib/admin/api-errors";
import { requireAdminRole } from "@/lib/admin/permissions";
import { db } from "@/lib/db/client";
import { plans } from "@/lib/db/schema";
import { invalidatePlanCache } from "@/lib/plans/plans-db";

const PatchSchema = z.object({
  name: z.string().optional(),
  basePriceCents: z.number().int().min(0).optional(),
  billingPeriod: z.string().optional(),
  staffAccountLimit: z.number().int().optional(),
  activeTripLimit: z.number().int().optional(),
  groupSizeLimit: z.number().int().nullable().optional(),
  aiBuilderEnabled: z.boolean().optional(),
  aiPhrasesEnabled: z.boolean().optional(),
  schoolToolsEnabled: z.boolean().optional(),
  viewerAccessEnabled: z.boolean().optional(),
  photoGalleryEnabled: z.boolean().optional(),
  payshareEnabled: z.boolean().optional(),
  visible: z.boolean().optional(),
  sortOrder: z.number().int().optional(),
  badge: z.string().nullable().optional(),
  publicDescription: z.string().nullable().optional(),
  featureList: z.array(z.string()).optional(),
});

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ planId: string }> },
) {
  try {
    await requireAdminRole("support");
    const { planId } = await ctx.params;
    const plan = await db
      .select()
      .from(plans)
      .where(eq(plans.id, planId))
      .limit(1)
      .then((rows) => rows[0] ?? null);
    if (!plan) return NextResponse.json({ error: "Not found." }, { status: 404 });
    return NextResponse.json({ plan });
  } catch (err) {
    return adminApiError(err);
  }
}

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ planId: string }> },
) {
  try {
    const admin = await requireAdminRole("admin");
    const { planId } = await ctx.params;

    const before = await db
      .select()
      .from(plans)
      .where(eq(plans.id, planId))
      .limit(1)
      .then((rows) => rows[0] ?? null);
    if (!before) return NextResponse.json({ error: "Not found." }, { status: 404 });

    const json = await req.json().catch(() => null);
    const parsed = PatchSchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid request." }, { status: 400 });
    }

    const [after] = await db
      .update(plans)
      .set({ ...parsed.data, updatedAt: new Date() })
      .where(eq(plans.id, planId))
      .returning();

    invalidatePlanCache();

    await logAdminAction({
      adminId: admin.id,
      action: "plan.update",
      entityType: "plan",
      entityId: planId,
      before,
      after,
      req,
    });

    return NextResponse.json({ ok: true, plan: after });
  } catch (err) {
    return adminApiError(err);
  }
}
