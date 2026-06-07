import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";

import { logAdminAction } from "@/lib/admin/audit";
import { adminApiError } from "@/lib/admin/api-errors";
import { canEditBilling, requireAdminRole } from "@/lib/admin/permissions";
import { updateInvoiceStatus } from "@/lib/billing/invoices";
import { db } from "@/lib/db/client";
import { invoices } from "@/lib/db/schema";

const PatchSchema = z.object({
  status: z.enum([
    "draft",
    "issued",
    "sent",
    "paid",
    "overdue",
    "void",
    "cancelled",
  ]),
  paymentReference: z.string().optional(),
  internalNotes: z.string().optional(),
});

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ invoiceId: string }> },
) {
  try {
    await requireAdminRole("support");
    const { invoiceId } = await ctx.params;
    const invoice = await db
      .select()
      .from(invoices)
      .where(eq(invoices.id, invoiceId))
      .limit(1)
      .then((rows) => rows[0] ?? null);
    if (!invoice) return NextResponse.json({ error: "Not found." }, { status: 404 });
    return NextResponse.json({ invoice });
  } catch (err) {
    return adminApiError(err);
  }
}

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ invoiceId: string }> },
) {
  try {
    const admin = await requireAdminRole("admin");
    if (!canEditBilling(admin.role)) {
      return NextResponse.json({ error: "Forbidden." }, { status: 403 });
    }

    const { invoiceId } = await ctx.params;
    const before = await db
      .select()
      .from(invoices)
      .where(eq(invoices.id, invoiceId))
      .limit(1)
      .then((rows) => rows[0] ?? null);
    if (!before) return NextResponse.json({ error: "Not found." }, { status: 404 });

    const json = await req.json().catch(() => null);
    const parsed = PatchSchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid request." }, { status: 400 });
    }

    const after = await updateInvoiceStatus({
      invoiceId,
      ...parsed.data,
    });

    await logAdminAction({
      adminId: admin.id,
      action: "invoice.update",
      entityType: "invoice",
      entityId: invoiceId,
      before,
      after,
      req,
    });

    return NextResponse.json({ ok: true, invoice: after });
  } catch (err) {
    return adminApiError(err);
  }
}
