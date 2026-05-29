"use client";

export function OfflineBanner(props: {
  online: boolean;
  cachedAt: string | null;
  version: number | null;
  status:
    | "updated"
    | "up_to_date"
    | "offline_no_cache"
    | "syncing"
    | "ready"
    | "error";
  onRefresh?: () => void;
  refreshing?: boolean;
}) {
  const { online, cachedAt, version, status, onRefresh, refreshing } = props;

  return (
    <div className="flex flex-col gap-2">
      {!online ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          <div className="font-medium">Offline mode</div>
          <div className="text-xs text-amber-800">
            {cachedAt
              ? `Showing saved trip from ${new Date(cachedAt).toLocaleString()}.`
              : "No saved trip yet."}
          </div>
        </div>
      ) : null}

      {version !== null && version > 0 && cachedAt ? (
        <p className="text-xs text-zinc-600">
          Trip data v{version}
          <span className="text-zinc-500">
            {" "}
            · cached {new Date(cachedAt).toLocaleString()}
          </span>
        </p>
      ) : null}

      {version === 0 ? (
        <p className="text-xs text-zinc-600">
          Preparing trip data… tap refresh to download when ready.
        </p>
      ) : null}

      {online && status === "updated" ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
          Trip updated and saved offline.
        </div>
      ) : null}

      {online && status === "syncing" ? (
        <div className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-700">
          Checking for updates…
        </div>
      ) : null}

      {onRefresh ? (
        <button
          type="button"
          onClick={onRefresh}
          disabled={!online || refreshing || status === "syncing"}
          className="inline-flex h-10 w-full items-center justify-center rounded-xl border border-zinc-200 bg-white px-4 text-sm font-medium text-zinc-900 disabled:opacity-50"
        >
          {refreshing || status === "syncing"
            ? "Refreshing…"
            : "Refresh trip data"}
        </button>
      ) : null}
    </div>
  );
}
