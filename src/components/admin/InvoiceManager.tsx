"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type InvoiceRow = {
  id: string;
  invoiceNumber: string;
  accountEmail: string;
  accountName: string;
  status: string;
  totalCents: number;
  dueDate: string;
};

export function InvoiceManager(props: { invoices: InvoiceRow[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);

  async function updateStatus(invoiceId: string, status: string) {
    setBusy(invoiceId);
    try {
      await fetch(`/api/admin/invoices/${invoiceId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status }),
      });
      router.refresh();
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-zinc-200 bg-white">
      <table className="min-w-full text-sm">
        <thead className="border-b border-zinc-200 bg-zinc-50 text-left text-xs uppercase text-zinc-500">
          <tr>
            <th className="px-4 py-3">Invoice</th>
            <th className="px-4 py-3">Account</th>
            <th className="px-4 py-3">Due</th>
            <th className="px-4 py-3">Total</th>
            <th className="px-4 py-3">Status</th>
            <th className="px-4 py-3">Actions</th>
          </tr>
        </thead>
        <tbody>
          {props.invoices.map((inv) => (
            <tr key={inv.id} className="border-t border-zinc-100">
              <td className="px-4 py-3 font-mono text-xs">{inv.invoiceNumber}</td>
              <td className="px-4 py-3">
                <p>{inv.accountName}</p>
                <p className="text-xs text-zinc-500">{inv.accountEmail}</p>
              </td>
              <td className="px-4 py-3">{inv.dueDate}</td>
              <td className="px-4 py-3">${(inv.totalCents / 100).toFixed(2)}</td>
              <td className="px-4 py-3">{inv.status}</td>
              <td className="px-4 py-3 space-x-2">
                {inv.status === "draft" ? (
                  <button
                    type="button"
                    disabled={busy === inv.id}
                    onClick={() => void updateStatus(inv.id, "issued")}
                    className="text-xs text-sky-700 underline"
                  >
                    Issue
                  </button>
                ) : null}
                {["issued", "sent"].includes(inv.status) ? (
                  <button
                    type="button"
                    disabled={busy === inv.id}
                    onClick={() => void updateStatus(inv.id, "paid")}
                    className="text-xs text-sky-700 underline"
                  >
                    Mark paid
                  </button>
                ) : null}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
