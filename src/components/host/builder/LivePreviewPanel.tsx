"use client";

import { useEffect, useMemo, useState } from "react";

import { CompactDaySheet } from "@/components/student/today/CompactDaySheet";
import { sortItemsByStartTime } from "@/lib/timeline/time-math";
import type { ActivityCategory } from "@/types/activity-category";

type ProposalState = {
  proposalId: string;
  assistantReply: string;
  needsClarification: boolean;
  proposedChanges: Array<{ summary: string }>;
  warnings: string[];
} | null;

type ItineraryDay = {
  id: string;
  date: string;
  cityLabel: string;
  calendarLabel?: string | null;
  weather?: {
    locationQuery: string;
    tempC: number | null;
    condition: string | null;
    advice: string | null;
    status: "available" | "too_far" | "unavailable";
    fetchedAt: string;
  } | null;
  items: Array<{
    id: string;
    startTime: string;
    endTime: string | null;
    title: string;
    locationName: string | null;
    address: string | null;
    mapQuery: string | null;
    transportNote: string | null;
    bringNote: string | null;
    hostNote: string | null;
    category?: ActivityCategory | null;
    sortOrder: number;
  }>;
  prep: Array<{ id: string; text: string }>;
};

export function LivePreviewPanel(props: {
  tripId: string;
  inviteCode: string;
  timezone: string;
  startDate: string;
  proposal: ProposalState;
  onApplied: () => void;
}) {
  const { tripId, inviteCode, timezone, startDate, proposal, onApplied } = props;
  const [days, setDays] = useState<ItineraryDay[]>([]);
  const [selectedDayId, setSelectedDayId] = useState<string | null>(null);
  const [publishing, setPublishing] = useState(false);
  const [applying, setApplying] = useState(false);

  async function reload() {
    const res = await fetch(`/api/host/${encodeURIComponent(inviteCode)}/itinerary`);
    if (!res.ok) return;
    const body = await res.json();
    const loaded = (body.days ?? []) as ItineraryDay[];
    setDays(loaded);
    if (!selectedDayId && loaded[0]) setSelectedDayId(loaded[0].id);
  }

  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inviteCode, tripId]);

  const selectedDay = useMemo(
    () => days.find((d) => d.id === selectedDayId) ?? days[0] ?? null,
    [days, selectedDayId],
  );

  const dayItems = useMemo(() => {
    if (!selectedDay) return [];
    return sortItemsByStartTime(selectedDay.items);
  }, [selectedDay]);

  async function applyProposal() {
    if (!proposal?.proposalId || proposal.needsClarification) return;
    setApplying(true);
    try {
      const res = await fetch(`/api/trips/${tripId}/apply-change`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ proposalId: proposal.proposalId }),
      });
      if (!res.ok) throw new Error("Apply failed");
      await reload();
      onApplied();
    } finally {
      setApplying(false);
    }
  }

  async function publish() {
    setPublishing(true);
    try {
      await fetch(`/api/trips/${tripId}/publish`, { method: "POST" });
    } finally {
      setPublishing(false);
    }
  }

  return (
    <div className="flex h-full min-h-0 flex-col bg-zinc-50">
      <div className="flex items-center justify-between border-b border-zinc-200 px-4 py-3">
        <div>
          <h2 className="text-sm font-semibold">Live preview</h2>
          <select
            value={selectedDay?.id ?? ""}
            onChange={(e) => setSelectedDayId(e.target.value)}
            className="mt-1 rounded border border-zinc-200 px-2 py-1 text-xs"
          >
            {days.map((d) => (
              <option key={d.id} value={d.id}>
                {d.date} — {d.cityLabel}
              </option>
            ))}
          </select>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={publish}
            disabled={publishing}
            className="h-9 rounded-lg bg-sky-700 px-3 text-xs font-medium text-white disabled:opacity-50"
          >
            {publishing ? "Publishing…" : "Publish"}
          </button>
        </div>
      </div>

      {proposal ? (
        <div className="border-b border-amber-200 bg-amber-50 px-4 py-3 text-sm">
          <p className="text-zinc-800">{proposal.assistantReply}</p>
          {proposal.warnings.length ? (
            <ul className="mt-2 text-xs text-amber-800">
              {proposal.warnings.map((w) => (
                <li key={w}>· {w}</li>
              ))}
            </ul>
          ) : null}
          {proposal.proposedChanges.length && !proposal.needsClarification ? (
            <div className="mt-3">
              <p className="text-xs font-semibold text-zinc-700">Proposed changes:</p>
              <ul className="mt-1 text-xs text-zinc-700">
                {proposal.proposedChanges.map((c, i) => (
                  <li key={i}>· {c.summary}</li>
                ))}
              </ul>
              <button
                type="button"
                onClick={applyProposal}
                disabled={applying}
                className="mt-2 h-8 rounded-lg bg-zinc-900 px-3 text-xs font-medium text-white"
              >
                {applying ? "Applying…" : "Apply changes"}
              </button>
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="mx-auto w-full max-w-md flex-1 overflow-hidden px-4 py-4">
        {selectedDay ? (
          <CompactDaySheet
            items={dayItems}
            prepItems={selectedDay.prep}
            tripTimezone={timezone}
            dateISO={selectedDay.date}
            cityLabel={selectedDay.cityLabel}
            weather={selectedDay.weather}
            tripStartDate={startDate}
            isViewingToday={false}
            mapsOnline
          />
        ) : (
          <p className="text-sm text-zinc-600">Add days via AI chat to see preview.</p>
        )}
      </div>
    </div>
  );
}
