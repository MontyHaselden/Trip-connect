"use client";

import { useState } from "react";

export default function HostPublishPage({
  params,
}: {
  params: { inviteCode: string };
}) {
  const inviteCode = params.inviteCode;
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<
    | { tripId: string; version: number; publishedAt?: string | null }
    | null
  >(null);
  const [error, setError] = useState<string | null>(null);

  async function onPublish() {
    setSubmitting(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch(
        `/api/host/${encodeURIComponent(inviteCode)}/publish`,
        { method: "POST" },
      );
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body?.error || "Publish failed");
      setResult(body);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Publish failed");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="min-h-dvh bg-zinc-50 px-5 py-10 text-zinc-900">
      <div className="mx-auto flex w-full max-w-md flex-col gap-5">
        <header className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold tracking-tight">Publish</h1>
          <p className="text-sm text-zinc-600">
            Publish updates so students can sync the latest version.
          </p>
        </header>

        <div className="rounded-2xl border border-zinc-200 bg-white p-5">
          <button
            type="button"
            onClick={onPublish}
            disabled={submitting}
            className="inline-flex h-11 w-full items-center justify-center rounded-xl bg-zinc-900 px-4 text-sm font-medium text-white disabled:opacity-50"
          >
            {submitting ? "Publishing…" : "Publish updates"}
          </button>

          {error ? (
            <p className="mt-4 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-800">
              {error}
            </p>
          ) : null}

          {result ? (
            <div className="mt-4 rounded-xl bg-zinc-50 px-3 py-2 text-sm text-zinc-800">
              <p>
                Published version <b>{result.version}</b>
              </p>
              {result.publishedAt ? (
                <p className="mt-1 text-xs text-zinc-600">
                  {new Date(result.publishedAt).toLocaleString()}
                </p>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
    </main>
  );
}

