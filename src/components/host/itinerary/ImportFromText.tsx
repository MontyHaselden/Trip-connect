"use client";

import { useState } from "react";

export function ImportFromText(props: {
  inviteCode: string;
  needsPublishConfirm: boolean;
  onImported: () => void;
  onError: (msg: string) => void;
}) {
  const { inviteCode, needsPublishConfirm, onImported, onError } = props;
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [importing, setImporting] = useState(false);
  const [stats, setStats] = useState<{
    daysCreated: number;
    daysUpdated: number;
    itemsCreated: number;
  } | null>(null);

  async function onImport() {
    setImporting(true);
    setStats(null);
    try {
      const res = await fetch(
        `/api/host/${encodeURIComponent(inviteCode)}/itinerary/import`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ text }),
        },
      );
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body?.error || "Import failed");
      setStats(body.stats);
      setText("");
      onImported();
    } catch (err) {
      onError(err instanceof Error ? err.message : "Import failed");
    } finally {
      setImporting(false);
    }
  }

  return (
    <section className="rounded-2xl border border-zinc-200 bg-white p-5">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between text-left"
      >
        <h2 className="text-base font-semibold">Import from text</h2>
        <span className="text-sm text-zinc-500">{open ? "Hide" : "Show"}</span>
      </button>

      {open ? (
        <div className="mt-4 flex flex-col gap-3">
          <p className="text-sm text-zinc-600">
            Paste an itinerary from email or a document. AI will create trip days
            and schedule items. You can edit everything afterward.
          </p>
          <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-950">
            Imported content publishes automatically — students see it when they
            refresh trip data.
          </p>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={10}
            placeholder="Paste your full trip itinerary here…"
            className="w-full rounded-xl border border-zinc-200 px-3 py-2 text-sm"
          />
          <button
            type="button"
            disabled={importing || text.trim().length < 20}
            onClick={onImport}
            className="inline-flex h-11 items-center justify-center rounded-xl bg-zinc-900 px-4 text-sm font-medium text-white disabled:opacity-50"
          >
            {importing ? "Importing…" : "Import itinerary"}
          </button>
          {stats ? (
            <p className="text-sm text-emerald-800">
              Imported {stats.daysCreated} new day(s), updated {stats.daysUpdated}{" "}
              day(s), added {stats.itemsCreated} item(s).
            </p>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
