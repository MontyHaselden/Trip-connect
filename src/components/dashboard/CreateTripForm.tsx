"use client";

import { useRouter } from "next/navigation";
import { useCallback, useRef, useState } from "react";

import { DashboardShell } from "./DashboardShell";

export function CreateTripForm() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [name, setName] = useState("");
  const [instructions, setInstructions] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const setUploadedFile = useCallback((next: File | null) => {
    setFile(next);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }, []);

  function onFilePick(next: File | null) {
    if (!next) return;
    setUploadedFile(next);
  }

  async function createTrip() {
    const trimmedName = name.trim();
    if (trimmedName.length < 2) {
      setError("Enter a trip name.");
      return;
    }

    setBusy(true);
    setError(null);
    try {
      const form = new FormData();
      form.set("name", trimmedName);
      const trimmedInstructions = instructions.trim();
      if (trimmedInstructions) form.set("instructions", trimmedInstructions);
      if (file) form.set("file", file);

      const res = await fetch("/api/trips", {
        method: "POST",
        body: form,
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || "Failed to create trip");

      const importError =
        typeof body.importError === "string" ? body.importError : null;
      const next = importError
        ? `/dashboard/trips/${body.tripId}/builder?importError=${encodeURIComponent(importError)}`
        : `/dashboard/trips/${body.tripId}/builder`;
      router.push(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create trip");
    } finally {
      setBusy(false);
    }
  }

  return (
    <DashboardShell>
      <div className="mx-auto max-w-lg px-5 py-10">
        <h1 className="text-2xl font-semibold">Create a trip</h1>
        <p className="mt-2 text-sm text-zinc-600">
          Name your trip, tell the AI what to do, and drop in last year&apos;s booklet or
          itinerary. It will work out dates, destinations, and the schedule.
        </p>
        {error ? <p className="mt-4 text-sm text-red-700">{error}</p> : null}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            createTrip();
          }}
          className="mt-6 space-y-4"
        >
          <label className="block">
            <span className="text-sm font-medium">Trip name</span>
            <input
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Japan School Trip 2026"
              className="mt-1 h-11 w-full rounded-xl border border-zinc-200 px-3 text-sm"
            />
          </label>

          <label className="block">
            <span className="text-sm font-medium">Instructions for AI</span>
            <textarea
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
              rows={4}
              placeholder="e.g. This PDF is from 2025 — move all dates to 2026, keep the same activities, and ignore photos and appendix pages."
              className="mt-1 w-full rounded-xl border border-zinc-200 px-3 py-2 text-sm"
            />
          </label>

          <div>
            <span className="text-sm font-medium">Trip document</span>
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setDragOver(true);
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragOver(false);
                onFilePick(e.dataTransfer.files?.[0] ?? null);
              }}
              className={[
                "mt-1 flex min-h-[140px] cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed px-4 py-6 text-center transition-colors",
                dragOver
                  ? "border-sky-400 bg-sky-50"
                  : "border-zinc-200 bg-zinc-50/50 hover:border-zinc-300",
              ].join(" ")}
              onClick={() => fileInputRef.current?.click()}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  fileInputRef.current?.click();
                }
              }}
              role="button"
              tabIndex={0}
            >
              {file ? (
                <>
                  <p className="text-sm font-medium text-zinc-900">{file.name}</p>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setUploadedFile(null);
                    }}
                    className="mt-2 text-xs font-medium text-zinc-600 underline"
                  >
                    Remove file
                  </button>
                </>
              ) : (
                <>
                  <p className="text-sm font-medium text-zinc-800">
                    Drop a PDF or Word doc here
                  </p>
                  <p className="mt-1 text-xs text-zinc-500">or click to browse</p>
                </>
              )}
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.docx,.txt,.md,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain"
              className="hidden"
              onChange={(e) => onFilePick(e.target.files?.[0] ?? null)}
            />
            <p className="mt-1.5 text-xs text-zinc-500">
              Optional — you can also add a document later in the builder.
            </p>
          </div>

          <button
            type="submit"
            disabled={busy}
            className="h-11 w-full rounded-xl bg-zinc-900 text-sm font-medium text-white disabled:opacity-50"
          >
            {busy
              ? file
                ? "Creating trip & importing…"
                : "Creating trip…"
              : file
                ? "Create trip from document"
                : "Create trip"}
          </button>
        </form>
      </div>
    </DashboardShell>
  );
}
