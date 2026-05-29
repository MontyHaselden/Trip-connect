"use client";

import { useEffect, useState } from "react";

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
  message?: string;
}) {
  const { online, cachedAt, version, status, message } = props;
  const [cachedAtLabel, setCachedAtLabel] = useState<string | null>(null);

  useEffect(() => {
    if (!cachedAt) {
      setCachedAtLabel(null);
      return;
    }
    setCachedAtLabel(new Date(cachedAt).toLocaleString());
  }, [cachedAt]);

  if (
    online &&
    status !== "error" &&
    status !== "updated" &&
    !(version !== null && version > 0 && cachedAt)
  ) {
    return null;
  }

  return (
    <div className="flex shrink-0 flex-col gap-2">
      {!online ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          <div className="font-medium">Offline mode</div>
          <div className="text-xs text-amber-800">
            {cachedAtLabel
              ? `Showing saved trip from ${cachedAtLabel}.`
              : "No saved trip yet."}
          </div>
        </div>
      ) : null}

      {status === "error" && message ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-900">
          {message}
        </div>
      ) : null}

      {online && status === "updated" ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
          Trip updated and saved offline.
        </div>
      ) : null}
    </div>
  );
}
