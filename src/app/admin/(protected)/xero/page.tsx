import { getAllPlatformSettings } from "@/lib/billing/settings";

export default async function AdminXeroPage() {
  const settings = await getAllPlatformSettings();
  const connected = settings.xero_connected === true;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-zinc-900">Xero integration</h1>
        <p className="text-sm text-zinc-600">Placeholder — connect Xero when ready.</p>
      </div>

      <div className="rounded-xl border border-zinc-200 bg-white p-4">
        <p className="text-sm">
          Status:{" "}
          <span className={connected ? "text-green-700" : "text-zinc-600"}>
            {connected ? "Connected" : "Not connected"}
          </span>
        </p>
        <dl className="mt-4 grid gap-2 text-sm sm:grid-cols-2">
          <div><dt className="text-zinc-500">Tenant ID</dt><dd className="font-mono text-xs">{String(settings.xero_tenant_id ?? "—")}</dd></div>
          <div><dt className="text-zinc-500">Client ID</dt><dd className="font-mono text-xs">{String(settings.xero_client_id ?? "—")}</dd></div>
          <div><dt className="text-zinc-500">Revenue account</dt><dd>{String(settings.xero_revenue_account_code ?? "—")}</dd></div>
          <div><dt className="text-zinc-500">GST tax type</dt><dd>{String(settings.xero_gst_tax_type ?? "—")}</dd></div>
        </dl>
        <div className="mt-6 flex gap-3">
          <button type="button" disabled className="h-10 rounded-lg border border-zinc-200 px-4 text-sm text-zinc-400">
            Sync customers (coming soon)
          </button>
          <button type="button" disabled className="h-10 rounded-lg border border-zinc-200 px-4 text-sm text-zinc-400">
            Sync invoices (coming soon)
          </button>
        </div>
      </div>
    </div>
  );
}
