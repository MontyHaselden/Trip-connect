"use client";

import { useEffect, useState } from "react";

type TripInfo = {
  viewerCode: string;
  viewerGalleryEnabled: boolean;
  viewerRoomDetailsEnabled: boolean;
};

export function TripViewersClient(props: { tripId: string }) {
  const [trip, setTrip] = useState<TripInfo | null>(null);
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    fetch(`/api/trips/${props.tripId}`)
      .then((r) => r.json())
      .then((body) => {
        if (body.trip) setTrip(body.trip);
      })
      .catch(() => null);
  }, [props.tripId]);

  async function save(patch: Partial<TripInfo>) {
    if (!trip) return;
    setSaving(true);
    const res = await fetch(`/api/trips/${props.tripId}/viewer-settings`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(patch),
    });
    if (res.ok) {
      const body = await res.json();
      setTrip(body.trip);
    }
    setSaving(false);
  }

  if (!trip) return <p className="text-sm text-zinc-600">Loading…</p>;

  const viewerUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/view/${trip.viewerCode}`
      : `/view/${trip.viewerCode}`;

  return (
    <div className="max-w-xl">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold">Viewer access</h1>
        <p className="mt-1 text-sm text-zinc-600">
          Share a read-only link with parents and staff. Student phone numbers are never shown.
        </p>
      </header>

      <div className="rounded-2xl border border-zinc-200 bg-white p-5">
        <p className="text-xs font-semibold uppercase text-zinc-500">Viewer link</p>
        <p className="mt-2 break-all font-mono text-sm">{viewerUrl}</p>
        <button
          type="button"
          onClick={async () => {
            await navigator.clipboard.writeText(viewerUrl);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
          }}
          className="mt-3 inline-flex h-9 items-center rounded-lg bg-zinc-900 px-3 text-sm font-medium text-white"
        >
          {copied ? "Copied" : "Copy link"}
        </button>
      </div>

      <div className="mt-6 space-y-4 rounded-2xl border border-zinc-200 bg-white p-5">
        <label className="flex items-center justify-between gap-4">
          <span className="text-sm">Show photo gallery to viewers</span>
          <input
            type="checkbox"
            checked={trip.viewerGalleryEnabled}
            disabled={saving}
            onChange={(e) => save({ viewerGalleryEnabled: e.target.checked })}
          />
        </label>
        <label className="flex items-center justify-between gap-4">
          <span className="text-sm">Show room details to viewers</span>
          <input
            type="checkbox"
            checked={trip.viewerRoomDetailsEnabled}
            disabled={saving}
            onChange={(e) => save({ viewerRoomDetailsEnabled: e.target.checked })}
          />
        </label>
      </div>
    </div>
  );
}
