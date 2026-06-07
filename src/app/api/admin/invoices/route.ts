import { NextResponse } from "next/server";
import { z } from "zod";

import { logAdminAction } from "@/lib/admin/audit";
import { adminApiError } from "@/lib/admin/api-errors";
import { canEditBilling, requireAdminRole } from "@/lib/admin/permissions";
import { createInvoice, listInvoices } from "@/lib/billing/invoices";

const CreateSchema = z.object({
  accountId: z.string().uuid(),
  subscriptionId: z.string().uuid().optional().nullable(),
  planId: z.string().uuid().optional().nullable(),
  subtotalCents: z.number().int().min(0),
  dueDate: z.string(),
  status: z.enum(["draft", "issued"]).optional(),
  internalNotes: z.string().optional(),
});

export async function GET() {
  try {
    await requireAdminRole("support");
    const rows = await listInvoices();
    return NextResponse.json({ invoices: rows });
  } catch (err) {
    return adminApiError(err);
  }
}

export async function POST(req: Request) {
  try {
    const admin = await requireAdminRole("admin");
    if (!canEditBilling(admin.role)) {
      return NextResponse.json({ error: "Forbidden." }, { status: 403 });
    }

    const json = await req.json().catch(() => null);
    const parsed = CreateSchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid request." }, { status: 400 });
    }

    const invoice = await createInvoice({
      ...parsed.data,
      adminId: admin.id,
    });

    await logAdminAction({
      adminId: admin.id,
      action: "invoice.create",
      entityType: "invoice",
      entityId: invoice.id,
      after: invoice,
      req,
    });

    return NextResponse.json({ ok: true, invoice });
  } catch (err) {
    return adminApiError(err);
  }
}
