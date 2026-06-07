import { InvoiceManager } from "@/components/admin/InvoiceManager";
import { listInvoices } from "@/lib/billing/invoices";

export default async function AdminInvoicesPage() {
  const rows = await listInvoices();

  const invoices = rows.map((r) => ({
    id: r.invoice.id,
    invoiceNumber: r.invoice.invoiceNumber,
    accountEmail: r.accountEmail,
    accountName: r.accountName,
    status: r.invoice.status,
    totalCents: r.invoice.totalCents,
    dueDate: r.invoice.dueDate,
  }));

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold text-zinc-900">Invoices</h1>
        <p className="text-sm text-zinc-600">
          Manual invoice mode: create records here, then send invoice externally. Xero sync can be connected later.
        </p>
      </div>
      <InvoiceManager invoices={invoices} />
    </div>
  );
}
