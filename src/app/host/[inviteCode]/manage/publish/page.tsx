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
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{
    version: number;
    publishedAt?: string | null;
  } | null>(null);

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
          setError(err instanceof Error ? err.message : "Failed to load preview");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [load]);

  async function onPublish() {
    setSubmitting(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch(`${api}/publish`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ confirm: true }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body?.error || "Publish failed");
      setResult(body);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Publish failed");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <main className="flex flex-col gap-4">
        <p className="text-sm text-zinc-600">Loading publish preview…</p>
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

  const canPublish = preview.needsPublishConfirm && preview.hasChanges;

  return (
    <main className="flex flex-col gap-5">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">Publish</h1>
        <p className="text-sm text-zinc-600">
          Send confirmed changes to students who have joined or cached this trip.
        </p>
      </header>

      {!preview.needsPublishConfirm ? (
        <section className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-950">
          <p className="font-medium">Changes go live automatically</p>
          <p className="mt-1 text-emerald-900">
            No students have joined yet and nothing has been published. Edits and
            imports are saved to the published snapshot automatically. Students will
            see the latest data when they join or tap Refresh trip data.
          </p>
          {preview.publishedVersion > 0 ? (
            <p className="mt-2 text-xs">
              Current published version: v{preview.publishedVersion}
              {preview.lastPublishedAt
                ? ` · ${new Date(preview.lastPublishedAt).toLocaleString()}`
                : ""}
            </p>
          ) : null}
        </section>
      ) : (
        <>
          <section className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
            Students may have cached trip data. Review changes below, then confirm
            publish so they receive updates on their next refresh.
            {preview.lastPublishedAt ? (
              <span className="mt-1 block text-xs">
                Last published {new Date(preview.lastPublishedAt).toLocaleString()}{" "}
                (v{preview.publishedVersion})
              </span>
            ) : null}
          </section>

          {preview.hasChanges ? (
            <section className="rounded-2xl border border-zinc-200 bg-white p-5">
              <h2 className="text-base font-semibold">What changed</h2>
              <div className="mt-4">
                <PublishDiff diff={preview.diff} />
              </div>
            </section>
          ) : (
            <section className="rounded-2xl border border-zinc-200 bg-white p-5 text-sm text-zinc-600">
              Nothing new to send to students. Your published snapshot matches the
              current draft.
            </section>
          )}
        </>
      )}

      {error ? (
        <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-800">{error}</p>
      ) : null}

      {result ? (
        <div className="rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
          <p>
            Published version <b>{result.version}</b>
          </p>
          {result.publishedAt ? (
            <p className="mt-1 text-xs">
              {new Date(result.publishedAt).toLocaleString()}
            </p>
          ) : null}
        </div>
      ) : null}

      {preview.needsPublishConfirm ? (
        <div className="rounded-2xl border border-zinc-200 bg-white p-5">
          <button
            type="button"
            onClick={onPublish}
            disabled={submitting || !canPublish}
            className="inline-flex h-11 w-full items-center justify-center rounded-xl bg-zinc-900 px-4 text-sm font-medium text-white disabled:opacity-50"
          >
            {submitting ? "Publishing…" : "Confirm and publish to students"}
          </button>
          {!preview.hasChanges ? (
            <p className="mt-3 text-center text-xs text-zinc-500">
              No changes to publish
            </p>
          ) : null}
        </div>
      ) : null}
    </main>
  );
}
