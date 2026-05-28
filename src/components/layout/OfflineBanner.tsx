"use client";

export function OfflineBanner(props: {
  online: boolean;
  cachedAt: string | null;
  status: "updated" | "up_to_date" | "offline_no_cache" | "syncing" | "ready" | "error";
}) {
  const { online, cachedAt, status } = props;

  if (!online) {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
        <div className="font-medium">Offline mode</div>
        <div className="text-xs text-amber-800">
          {cachedAt ? `Showing saved trip from ${new Date(cachedAt).toLocaleString()}.` : "No saved trip yet."}
        </div>
      </div>
    );
  }

  if (status === "updated") {
    return (
      <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
        Trip updated and saved offline.
      </div>
    );
  }

  if (status === "syncing") {
    return (
      <div className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-700">
        Checking for updates…
      </div>
    );
  }

  return null;
}

