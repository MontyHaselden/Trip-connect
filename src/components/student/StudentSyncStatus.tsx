"use client";

import type { TripCacheState } from "@/hooks/useTripCache";

/** Error/auth sync messaging only — not shown on the main Today screen for routine status. */
export function StudentSyncStatus(props: {
  online: boolean;
  cachedAt: string | null;
  version: number | null;
  status: TripCacheState["status"];
  message?: string;
}) {
  const { status, message } = props;

  if (status === "error" || status === "unauthorized") {
    return (
      <p className="text-[11px] leading-snug text-[var(--cat-important)]">
        {message ?? "Could not refresh trip data."}
      </p>
    );
  }

  return null;
}
