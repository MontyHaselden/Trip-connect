"use client";

import { useRouter } from "next/navigation";
import { useCallback, useRef, useState } from "react";

import { savePendingTripImport } from "@/lib/client/pending-trip-import";

import { DashboardShell } from "./DashboardShell";

export function CreateTripChoice() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [wizardName, setWizardName] = useState("");
  const [aiName, setAiName] = useState("");
  const [instructions, setInstructions] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [busy, setBusy] = useState<"wizard" | "ai" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const setUploadedFile = useCallback((next: File | null) => {
    setFile(next);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }, []);

  async function createWizardTrip() {
    const trimmed = wizardName.trim();
    if (trimmed.length < 2) {
      setError("Enter a trip name for guided setup.");
      return;
    }
    setBusy("wizard");
    setError(null);
    try {
      const res = await fetch("/api/trips", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: trimmed, setupMethod: "wizard" }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || "Failed to create trip");
      router.push(`/dashboard/trips/${body.tripId}/wizard?step=1`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create trip");
    } finally {
      setBusy(null);
    }
  }

  async function createAiTrip() {
    const trimmed = aiName.trim();
    if (trimmed.length < 2) {
      setError("Enter a trip name for AI import.");
      return;
    }
    setBusy("ai");
    setError(null);
    try {
      const form = new FormData();
      form.set("name", trimmed);
      form.set("setupMethod", "ai");
      const res = await fetch("/api/trips", { method: "POST", body: form });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || "Failed to create trip");
      const tripId = body.tripId as string;
      if (file) {
        await savePendingTripImport({
          tripId,
          file,
          instructions: instructions.trim() || null,
        });
        router.push(`/dashboard/trips/${tripId}/builder?building=1`);
        return;
      }
      router.push(`/dashboard/trips/${tripId}/builder`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create trip");
    } finally {
      setBusy(null);
    }
  }

  return (
    <DashboardShell>
      <div className="mx-auto max-w-5xl px-5 py-10">
        <h1 className="text-2xl font-semibold">Create a trip</h1>
        <p className="mt-2 text-sm text-zinc-600">
          Choose how you want to set up your trip. Guided setup builds the framework step by step
          without AI. AI import extracts what it can from a document.
        </p>
        {error ? <p className="mt-4 text-sm text-red-700">{error}</p> : null}

        <div className="mt-8 grid gap-6 md:grid-cols-2">
          <section className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold">Guided setup</h2>
            <p className="mt-2 text-sm text-zinc-600">
              Step-by-step wizard for dates, transport, places, accommodation, and activities. No AI
              required.
            </p>
            <label className="mt-4 block">
              <span className="text-sm font-medium">Trip name</span>
              <input
                value={wizardName}
                onChange={(e) => setWizardName(e.target.value)}
                placeholder="Japan School Trip 2026"
                className="mt-1 h-11 w-full rounded-xl border border-zinc-200 px-3 text-sm"
              />
            </label>
            <button
              type="button"
              disabled={busy !== null}
              onClick={createWizardTrip}
              className="mt-4 h-11 w-full rounded-xl bg-zinc-900 text-sm font-medium text-white disabled:opacity-50"
            >
              {busy === "wizard" ? "Starting…" : "Start guided setup"}
            </button>
          </section>

          <section className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold">AI import</h2>
            <p className="mt-2 text-sm text-zinc-600">
              Upload last year&apos;s booklet. We&apos;ll extract cities, hotels, and transport —
              anything we miss you can fill in next.
            </p>
            <label className="mt-4 block">
              <span className="text-sm font-medium">Trip name</span>
              <input
                value={aiName}
                onChange={(e) => setAiName(e.target.value)}
                placeholder="Japan School Trip 2026"
                className="mt-1 h-11 w-full rounded-xl border border-zinc-200 px-3 text-sm"
              />
            </label>
            <label className="mt-3 block">
              <span className="text-sm font-medium">Instructions for AI</span>
              <textarea
                value={instructions}
                onChange={(e) => setInstructions(e.target.value)}
                rows={3}
                placeholder="Move dates to 2026, keep activities…"
                className="mt-1 w-full rounded-xl border border-zinc-200 px-3 py-2 text-sm"
              />
            </label>
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setDragOver(true);
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragOver(false);
                const f = e.dataTransfer.files?.[0];
                if (f) setUploadedFile(f);
              }}
              className={[
                "mt-3 flex min-h-[100px] cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed px-4 py-4 text-center",
                dragOver ? "border-sky-400 bg-sky-50" : "border-zinc-200 bg-zinc-50/50",
              ].join(" ")}
              onClick={() => fileInputRef.current?.click()}
              role="button"
              tabIndex={0}
            >
              {file ? (
                <p className="text-sm font-medium">{file.name}</p>
              ) : (
                <p className="text-sm text-zinc-600">Drop PDF or Word doc (optional)</p>
              )}
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.docx,.txt,.md"
              className="hidden"
              onChange={(e) => setUploadedFile(e.target.files?.[0] ?? null)}
            />
            <button
              type="button"
              disabled={busy !== null}
              onClick={createAiTrip}
              className="mt-4 h-11 w-full rounded-xl border border-zinc-300 bg-white text-sm font-medium disabled:opacity-50"
            >
              {busy === "ai"
                ? "Opening builder…"
                : file
                  ? "Create & build from document"
                  : "Create with AI"}
            </button>
          </section>
        </div>
      </div>
    </DashboardShell>
  );
}
