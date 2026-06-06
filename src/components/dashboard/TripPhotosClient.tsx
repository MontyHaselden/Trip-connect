"use client";

import { useCallback, useEffect, useState } from "react";

type PhotoRow = {
  id: string;
  tripDayId: string;
  type: string;
  imageUrl: string;
  status: string;
  uploadedAt: string;
};

export function TripPhotosClient(props: { tripId: string }) {
  const [photos, setPhotos] = useState<PhotoRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch(`/api/trips/${props.tripId}/photos`);
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(body.error ?? "Failed to load photos");
    setPhotos(body.photos ?? []);
  }, [props.tripId]);

  useEffect(() => {
    load()
      .catch((err) => setError(err instanceof Error ? err.message : "Failed"))
      .finally(() => setLoading(false));
  }, [load]);

  async function hidePhoto(photoId: string) {
    const res = await fetch(`/api/photos/${photoId}/hide`, { method: "POST" });
    if (!res.ok) return;
    await load();
  }

  if (loading) return <p className="text-sm text-zinc-600">Loading photos…</p>;
  if (error) return <p className="text-sm text-red-700">{error}</p>;

  return (
    <div>
      <header className="mb-6">
        <h1 className="text-2xl font-semibold">Photo moderation</h1>
        <p className="mt-1 text-sm text-zinc-600">
          Review student uploads. Hidden photos are removed from published snapshots.
        </p>
      </header>
      {!photos.length ? (
        <p className="rounded-xl border border-dashed border-zinc-300 p-8 text-center text-sm text-zinc-600">
          No photos uploaded yet.
        </p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {photos.map((p) => (
            <div key={p.id} className="overflow-hidden rounded-xl border border-zinc-200 bg-white">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={p.imageUrl} alt="" className="aspect-video w-full object-cover" />
              <div className="flex items-center justify-between p-3 text-xs">
                <span className="capitalize text-zinc-600">{p.type}</span>
                {p.status === "visible" ? (
                  <button
                    type="button"
                    onClick={() => hidePhoto(p.id)}
                    className="font-medium text-red-700 hover:underline"
                  >
                    Hide
                  </button>
                ) : (
                  <span className="text-zinc-400">Hidden</span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
