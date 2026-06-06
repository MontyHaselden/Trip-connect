"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

import { AiChatPanel } from "./AiChatPanel";
import { LivePreviewPanel } from "./LivePreviewPanel";

export function BuilderClient(props: { tripId: string }) {
  const { tripId } = props;
  const searchParams = useSearchParams();
  const importError = searchParams.get("importError");
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

  useEffect(() => {
    fetch(`/api/trips/${tripId}`)
      .then((r) => r.json())
      .then((body) => {
        if (body.trip) setTrip(body.trip);
      })
      .catch(() => null);
  }, [tripId]);

  if (!trip) {
    return <p className="p-10 text-sm text-zinc-600">Loading builder…</p>;
  }

  return (
    <div className="flex h-[calc(100dvh-0px)] min-h-0 flex-col">
      {importError ? (
        <div className="shrink-0 border-b border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-950">
          Trip created, but the document could not be imported: {importError}
        </div>
      ) : null}
      <div className="flex min-h-0 flex-1">
      <div className="w-full max-w-md shrink-0 lg:max-w-lg">
        <AiChatPanel
          tripId={tripId}
          onProposal={setProposal}
          onDocumentImported={() => setReloadKey((k) => k + 1)}
        />
      </div>
      <div className="min-w-0 flex-1">
        <LivePreviewPanel
          key={reloadKey}
          tripId={tripId}
          inviteCode={trip.inviteCode}
          timezone={trip.timezone}
          startDate={trip.startDate}
          proposal={proposal}
          onApplied={() => {
            setProposal(null);
            setReloadKey((k) => k + 1);
          }}
        />
      </div>
      </div>
    </div>
  );
}
