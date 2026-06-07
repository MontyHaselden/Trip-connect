"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import {
  clearPendingTripImport,
  peekPendingTripImport,
} from "@/lib/client/pending-trip-import";
import { runTripDocumentImport } from "@/lib/client/run-trip-document-import";
import type { TripImportProgress } from "@/types/trip-import-progress";

import { AiChatPanel } from "./AiChatPanel";
import { LivePreviewPanel } from "./LivePreviewPanel";

export function BuilderClient(props: { tripId: string }) {
  const { tripId } = props;
  const router = useRouter();
  const searchParams = useSearchParams();
  const building = searchParams.get("building") === "1";
  const importErrorParam = searchParams.get("importError");

  const importStarted = useRef(false);
  const [editorOpen, setEditorOpen] = useState(false);
  const [trip, setTrip] = useState<{
    name?: string;
    inviteCode: string;
    timezone: string;
    startDate: string;
    endDate: string;
  } | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [isBuilding, setIsBuilding] = useState(building);
  const [importError, setImportError] = useState<string | null>(importErrorParam);
  const [buildProgress, setBuildProgress] = useState<TripImportProgress | null>(null);

  useEffect(() => {
    fetch(`/api/trips/${tripId}`)
      .then((r) => r.json())
      .then((body) => {
        if (body.trip) setTrip(body.trip);
      })
      .catch(() => null);
  }, [tripId]);

  useEffect(() => {
    if (!building || importStarted.current) return;
    importStarted.current = true;

    let cancelled = false;

    (async () => {
      const pending = await peekPendingTripImport(tripId);
      if (cancelled) return;

      if (!pending) {
        setIsBuilding(false);
        if (building) clearBuildingParam();
        return;
      }

      const result = await runTripDocumentImport({
        tripId,
        file: pending.file,
        fileName: pending.fileName,
        instructions: pending.instructions,
        onProgress: (event) => {
          if (cancelled) return;
          setBuildProgress(event);
          if (event.type === "trip_dates") {
            setTrip((prev) =>
              prev
                ? {
                    ...prev,
                    startDate: event.startDate,
                    endDate: event.endDate,
                    timezone: event.timezone,
                  }
                : prev,
            );
          }
          if (event.type === "done") {
            setTrip((prev) =>
              prev
                ? {
                    ...prev,
                    startDate: event.trip.startDate,
                    endDate: event.trip.endDate,
                    timezone: event.trip.timezone,
                  }
                : prev,
            );
          }
        },
      });

      if (cancelled) return;

      if (!result.ok) {
        await clearPendingTripImport(tripId);
        setImportError(result.error);
        setIsBuilding(false);
        setBuildProgress(null);
        router.replace(
          `/dashboard/trips/${tripId}/builder?importError=${encodeURIComponent(result.error)}`,
        );
        return;
      }

      await clearPendingTripImport(tripId);
      setIsBuilding(false);
      setBuildProgress(null);
      setReloadKey((k) => k + 1);
      clearBuildingParam();
    })();

    return () => {
      cancelled = true;
    };
  }, [building, tripId, router]);

  function clearBuildingParam() {
    router.replace(`/dashboard/trips/${tripId}/builder`);
  }

  if (!trip) {
    return <p className="p-10 text-sm text-zinc-600">Loading builder…</p>;
  }

  return (
    <div className="relative flex h-[calc(100dvh-0px)] min-h-0 flex-col">
      {importError ? (
        <div className="shrink-0 border-b border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-950">
          Document import failed: {importError}. Open the AI editor to try again or attach
          another file.
        </div>
      ) : null}

      <div className="relative min-h-0 flex-1">
        <LivePreviewPanel
          key={reloadKey}
          tripId={tripId}
          tripName={trip.name ?? "Your trip"}
          inviteCode={trip.inviteCode}
          timezone={trip.timezone}
          startDate={trip.startDate}
          endDate={trip.endDate}
          building={isBuilding}
          buildProgress={buildProgress}
          onBuildingDone={() => {
            setIsBuilding(false);
            setBuildProgress(null);
            clearBuildingParam();
          }}
        />

        {!editorOpen ? (
          <button
            type="button"
            onClick={() => setEditorOpen(true)}
            className="absolute bottom-6 right-6 z-20 rounded-full bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white shadow-lg"
          >
            AI editor
          </button>
        ) : null}

        {editorOpen ? (
          <>
            <button
              type="button"
              aria-label="Close AI editor"
              className="absolute inset-0 z-30 bg-black/30"
              onClick={() => setEditorOpen(false)}
            />
            <div className="absolute inset-y-0 right-0 z-40 w-full max-w-md shadow-xl">
              <AiChatPanel
                tripId={tripId}
                inviteCode={trip.inviteCode}
                timezone={trip.timezone}
                startDate={trip.startDate}
                endDate={trip.endDate}
                onClose={() => setEditorOpen(false)}
                onApplied={() => setReloadKey((k) => k + 1)}
                onImportProgress={(event) => {
                  setIsBuilding(true);
                  setBuildProgress(event);
                  if (event.type === "trip_dates") {
                    setTrip((prev) =>
                      prev
                        ? {
                            ...prev,
                            startDate: event.startDate,
                            endDate: event.endDate,
                            timezone: event.timezone,
                          }
                        : prev,
                    );
                  }
                }}
                onDocumentImported={() => {
                  setIsBuilding(false);
                  setImportError(null);
                  setBuildProgress(null);
                  setReloadKey((k) => k + 1);
                }}
              />
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}
