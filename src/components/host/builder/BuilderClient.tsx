"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { AiChatPanel } from "./AiChatPanel";
import { LivePreviewPanel } from "./LivePreviewPanel";

export function BuilderClient(props: { tripId: string }) {
  const { tripId } = props;
  const router = useRouter();
  const searchParams = useSearchParams();
  const building = searchParams.get("building") === "1";
  const importError = searchParams.get("importError");

  const [editorOpen, setEditorOpen] = useState(false);
  const [trip, setTrip] = useState<{
    name: string;
    inviteCode: string;
    timezone: string;
    startDate: string;
  } | null>(null);
  const [proposal, setProposal] = useState<{
    proposalId: string;
    assistantReply: string;
    needsClarification: boolean;
    proposedChanges: Array<{ summary: string }>;
    warnings: string[];
  } | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [isBuilding, setIsBuilding] = useState(building);

  useEffect(() => {
    fetch(`/api/trips/${tripId}`)
      .then((r) => r.json())
      .then((body) => {
        if (body.trip) setTrip(body.trip);
      })
      .catch(() => null);
  }, [tripId]);

  useEffect(() => {
    if (importError) {
      setIsBuilding(false);
    }
  }, [importError]);

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
          inviteCode={trip.inviteCode}
          timezone={trip.timezone}
          startDate={trip.startDate}
          proposal={proposal}
          building={isBuilding}
          onBuildingDone={() => {
            setIsBuilding(false);
            clearBuildingParam();
          }}
          onApplied={() => {
            setProposal(null);
            setReloadKey((k) => k + 1);
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
            <div className="absolute inset-y-0 left-0 z-40 w-full max-w-md shadow-xl">
              <AiChatPanel
                tripId={tripId}
                onClose={() => setEditorOpen(false)}
                onProposal={(data) => {
                  setProposal(data);
                  setEditorOpen(false);
                }}
                onDocumentImported={() => {
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
