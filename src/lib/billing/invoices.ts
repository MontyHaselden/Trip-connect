import { desc, eq, sql } from "drizzle-orm";

import { calcGstAmount } from "@/lib/billing/gst";
import { getGstSettings } from "@/lib/billing/settings";
import { db } from "@/lib/db/client";
import { hostAccounts, invoices } from "@/lib/db/schema";

export async function generateInvoiceNumber(): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `TC-${year}-`;
  const latest = await db
    .select({ invoiceNumber: invoices.invoiceNumber })
    .from(invoices)
    .where(sql`${invoices.invoiceNumber} LIKE ${prefix + "%"}`)
    .orderBy(desc(invoices.invoiceNumber))
    .limit(1)
    .then((rows) => rows[0] ?? null);

  let seq = 1;
  if (latest) {
    const parts = latest.invoiceNumber.split("-");
    const n = parseInt(parts[parts.length - 1] ?? "0", 10);
    if (!Number.isNaN(n)) seq = n + 1;
  }
  return `${prefix}${String(seq).padStart(4, "0")}`;
}

export async function createInvoice(params: {
  accountId: string;
  subscriptionId?: string | null;
  planId?: string | null;
  subtotalCents: number;
  dueDate: string;
  status?: "draft" | "issued";
  internalNotes?: string;
  adminId: string;
}) {
  const gst = await getGstSettings();
  const gstAmountCents = gst.gstEnabled
    ? calcGstAmount(params.subtotalCents, gst.gstRate)
    : 0;
  const totalCents = params.subtotalCents + gstAmountCents;
  const invoiceNumber = await generateInvoiceNumber();

  const [created] = await db
    .insert(invoices)
    .values({
      accountId: params.accountId,
      subscriptionId: params.subscriptionId ?? null,
      planId: params.planId ?? null,
      invoiceNumber,
      dueDate: params.dueDate,
      subtotalCents: params.subtotalCents,
      gstRate: String(gst.gstRate),
      gstAmountCents,
      totalCents,
      status: params.status ?? "draft",
      internalNotes: params.internalNotes ?? null,
      createdByAdminId: params.adminId,
    })
    .returning();

  return created;
}

export async function updateInvoiceStatus(params: {
  invoiceId: string;
  status: "draft" | "issued" | "sent" | "paid" | "overdue" | "void" | "cancelled";
  paymentReference?: string;
  internalNotes?: string;
}) {
  const [updated] = await db
    .update(invoices)
    .set({
      status: params.status,
      paymentReference: params.paymentReference ?? undefined,
      internalNotes: params.internalNotes ?? undefined,
      updatedAt: new Date(),
    })
    .where(eq(invoices.id, params.invoiceId))
    .returning();
  return updated ?? null;
}

export async function listInvoices(params?: {
  status?: (typeof invoices.$inferSelect)["status"];
  limit?: number;
}) {
  const base = db
    .select({
      invoice: invoices,
      accountEmail: hostAccounts.email,
      accountName: hostAccounts.fullName,
      schoolName: hostAccounts.schoolName,
    })
    .from(invoices)
    .innerJoin(hostAccounts, eq(hostAccounts.id, invoices.accountId))
    .orderBy(desc(invoices.createdAt))
    .limit(params?.limit ?? 100);

  if (params?.status) {
    return base.where(eq(invoices.status, params.status));
  }
  return base;
}
