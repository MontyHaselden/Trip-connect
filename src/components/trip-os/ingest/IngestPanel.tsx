"use client";

import { useState } from "react";

import type { TripCommand } from "@/lib/trip-engine/commands";

import { AsyncButton } from "../shared/AsyncButton";
import type { TripEntityGraph } from "@/lib/trip-engine/types";
import { newId } from "@/lib/host/wizard/types";

type ProposedCommand = {
  summary: string;
  commands: TripCommand[];
};

function proposeFromText(text: string, graph: TripEntityGraph, groupId: string): ProposedCommand | null {
  const trimmed = text.trim();
  if (!trimmed) return null;

  const onTheMatch = trimmed.match(/(.+?)\s+on\s+(?:the\s+)?(\d{1,2})(?:st|nd|rd|th)?/i);
  if (onTheMatch) {
    const venue = onTheMatch[1].trim();
    const dayNum = parseInt(onTheMatch[2], 10);
    const startDate = graph.basics.startDate;
    if (startDate && startDate !== "2000-01-01") {
      const month = startDate.slice(0, 7);
      const date = `${month}-${String(dayNum).padStart(2, "0")}`;
      return {
        summary: `Add "${venue}" on ${date}`,
        commands: [
          {
            type: "addActivity",
            groupId,
            activity: {
              id: newId(),
              title: venue,
              date,
              endDate: null,
              startTime: "10:00",
              endTime: null,
              isTimeTbc: false,
              category: "activity",
              locationName: venue,
              address: null,
              isLocationTbc: false,
              transportNote: null,
              leaveByTime: null,
              bringNote: null,
              description: null,
              audienceType: "everyone",
              audienceId: null,
              bookingStatus: "not_booked",
            },
          },
        ],
      };
    }
  }

  const goToMatch = trimmed.match(/go\s+to\s+(.+?)\s+on\s+(\d{4}-\d{2}-\d{2})/i);
  if (goToMatch) {
    const venue = goToMatch[1].trim();
    const date = goToMatch[2];
    return {
      summary: `Add activity "${venue}" on ${date}`,
      commands: [
        {
          type: "addActivity",
          groupId,
          activity: {
            id: newId(),
            title: venue,
            date,
            endDate: null,
            startTime: "10:00",
            endTime: null,
            isTimeTbc: false,
            category: "activity",
            locationName: venue,
            address: null,
            isLocationTbc: false,
            transportNote: null,
            leaveByTime: null,
            bringNote: null,
            description: null,
            audienceType: "everyone",
            audienceId: null,
            bookingStatus: "not_booked",
          },
        },
      ],
    };
  }

  return null;
}

export function IngestPanel(props: {
  tripId: string;
  graph: TripEntityGraph;
  groupId: string;
  onDispatch: (commands: TripCommand[]) => Promise<boolean>;
  onReload: () => void;
  saving?: boolean;
}) {
  const [message, setMessage] = useState("");
  const [proposal, setProposal] = useState<ProposedCommand | null>(null);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handlePropose() {
    setError(null);
    const p = proposeFromText(message, props.graph, props.groupId);
    if (!p) {
      setError('Could not parse intent. Try: "Disney on the 17th" or "go to Disneyland Tokyo on 2026-08-17"');
      setProposal(null);
      return;
    }
    setProposal(p);
  }

  async function handleConfirm() {
    if (!proposal) return;
    const ok = await props.onDispatch(proposal.commands);
    if (ok) {
      setProposal(null);
      setMessage("");
    }
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    setError(null);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch(`/api/trips/${props.tripId}/import-document`, {
        method: "POST",
        body: form,
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || "Import failed");
      props.onReload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Import failed");
    } finally {
      setImporting(false);
      e.target.value = "";
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">AI / Import</h2>
        <p className="text-sm text-zinc-600">
          Primary ingestion path — proposes commands, you confirm, same API as calendar corrections.
        </p>
      </div>

      <div className="rounded-xl border border-zinc-200 p-4">
        <h3 className="text-sm font-semibold">Upload itinerary</h3>
        <p className="mt-1 text-xs text-zinc-500">PDF, Word, or spreadsheet</p>
        <input
          type="file"
          accept=".pdf,.doc,.docx,.txt,.csv,.xlsx"
          onChange={(e) => void handleFileUpload(e)}
          disabled={importing}
          className="mt-3 block w-full text-sm"
        />
        {importing ? <p className="mt-2 text-xs text-zinc-500">Importing…</p> : null}
      </div>

      <div className="rounded-xl border border-zinc-200 p-4">
        <h3 className="text-sm font-semibold">Chat intent</h3>
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder='e.g. "We plan to go to Disney on the 17th"'
          rows={3}
          className="mt-3 w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm"
        />
        <button
          type="button"
          onClick={handlePropose}
          className="mt-3 rounded-lg border border-zinc-200 px-4 py-2 text-sm font-medium hover:bg-zinc-50"
        >
          Propose commands
        </button>
      </div>

      {proposal ? (
        <div className="rounded-xl border border-blue-200 bg-blue-50 p-4">
          <p className="text-sm font-medium text-blue-900">Confirm: {proposal.summary}</p>
          <p className="mt-1 text-xs text-blue-700">
            {proposal.commands.length} command(s) will be dispatched via PATCH /setup/commands
          </p>
          <div className="mt-3 flex gap-2">
            <AsyncButton
              onClick={() => void handleConfirm()}
              loading={props.saving}
              loadingLabel="Applying…"
              className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white"
            >
              Yes, apply
            </AsyncButton>
            <button
              type="button"
              onClick={() => setProposal(null)}
              className="rounded-lg border border-zinc-200 px-4 py-2 text-sm"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : null}

      {error ? <p className="text-sm text-red-700">{error}</p> : null}
    </div>
  );
}
