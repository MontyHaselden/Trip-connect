import { desc, eq, sql } from "drizzle-orm";

import { calcGstAmount, formatPublicPrice } from "@/lib/billing/gst";
import { getGstSettings } from "@/lib/billing/settings";
import { updateSubscriptionBillingStatus } from "@/lib/billing/subscriptions";
import { getSupportEmail, sendEmail } from "@/lib/email/send-email";
import { accountActivatedEmail, invoiceSentEmail } from "@/lib/email/templates";
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
  const before = await db
    .select()
    .from(invoices)
    .where(eq(invoices.id, params.invoiceId))
    .limit(1)
    .then((rows) => rows[0] ?? null);

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

  if (updated && params.status === "paid" && before?.status !== "paid") {
    await updateSubscriptionBillingStatus({
      accountId: updated.accountId,
      billingStatus: "active",
      clearTrial: true,
    });

    const account = await db
      .select({ email: hostAccounts.email, fullName: hostAccounts.fullName })
      .from(hostAccounts)
      .where(eq(hostAccounts.id, updated.accountId))
      .limit(1)
      .then((rows) => rows[0] ?? null);

    if (account?.email) {
      const supportEmail = await getSupportEmail();
      const mail = accountActivatedEmail({
        fullName: account.fullName,
        supportEmail,
      });
      void sendEmail({ to: account.email, ...mail });
    }
  }

  if (updated && params.status === "sent" && before?.status !== "sent") {
    const account = await db
      .select({ email: hostAccounts.email, fullName: hostAccounts.fullName })
      .from(hostAccounts)
      .where(eq(hostAccounts.id, updated.accountId))
      .limit(1)
      .then((rows) => rows[0] ?? null);

    if (account?.email) {
      const gst = await getGstSettings();
      const totalDisplay = formatPublicPrice({
        basePriceCents: updated.subtotalCents,
        billingPeriod: "year",
        settings: gst,
      }).display;
      const supportEmail = await getSupportEmail();
      const mail = invoiceSentEmail({
        fullName: account.fullName,
        invoiceNumber: updated.invoiceNumber,
        totalDisplay,
        dueDate: updated.dueDate,
        supportEmail,
      });
      void sendEmail({ to: account.email, ...mail });
    }
  }

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
