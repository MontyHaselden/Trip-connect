"use client";

import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import { PublishDiff } from "@/components/host/publish/PublishDiff";
import { hostJson } from "@/components/host/shared/host-fetch";
import type { SnapshotDiff } from "@/lib/publish/compare-snapshots";

type PublishPreview = {
  needsPublishConfirm: boolean;
  publishedVersion: number;
  lastPublishedAt: string | null;
  hasChanges: boolean;
  diff: SnapshotDiff;
};

export default function HostPublishPage() {
  const params = useParams();
  const inviteCode = String(params.inviteCode ?? "");
  const api = `/api/host/${encodeURIComponent(inviteCode)}`;

  const [preview, setPreview] = useState<PublishPreview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const data = await hostJson<PublishPreview>(`${api}/publish/preview`);
    setPreview(data);
  }, [api]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await load();
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load status");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [load]);

  if (loading) {
    return (
      <main className="flex flex-col gap-4">
        <p className="text-sm text-zinc-600">Loading publish status…</p>
      </main>
    );
  }

  if (!preview) {
    return (
      <main className="flex flex-col gap-4">
        <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-800">
          {error ?? "Failed to load"}
        </p>
      </main>
    );
  }

  return (
    <main className="flex flex-col gap-5">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">Publish status</h1>
        <p className="text-sm text-zinc-600">
          Changes publish automatically when you save edits or import content.
        </p>
      </header>

      <section className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-950">
        <p className="font-medium">Auto-publish is on</p>
        <p className="mt-1 text-emerald-900">
          Students and teachers see the latest trip data when they tap Refresh trip
          data on Today. No manual confirm step.
        </p>
        {preview.publishedVersion > 0 ? (
          <p className="mt-2 text-xs">
            Current published version: v{preview.publishedVersion}
            {preview.lastPublishedAt
              ? ` · ${new Date(preview.lastPublishedAt).toLocaleString()}`
              : ""}
          </p>
        ) : (
          <p className="mt-2 text-xs">
            Not published yet — open the trip app or make an edit to publish the
            first snapshot.
          </p>
        )}
      </section>

      {preview.hasChanges ? (
        <section className="rounded-2xl border border-zinc-200 bg-white p-5">
          <h2 className="text-base font-semibold">Unpublished draft changes</h2>
          <p className="mt-1 text-sm text-zinc-600">
            These will go live on the next save or when you re-open the trip app.
          </p>
          <div className="mt-4">
            <PublishDiff diff={preview.diff} />
          </div>
        </section>
      ) : (
        <section className="rounded-2xl border border-zinc-200 bg-white p-5 text-sm text-zinc-600">
          Published snapshot matches your current draft.
        </section>
      )}

      {error ? (
        <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-800">{error}</p>
      ) : null}
    </main>
  );
}
