"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

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
  building?: boolean;
  onBuildingDone?: () => void;
  onApplied: () => void;
}) {
  const {
    tripId,
    inviteCode,
    timezone,
    startDate,
    proposal,
    building,
    onBuildingDone,
    onApplied,
  } = props;
  const [days, setDays] = useState<ItineraryDay[]>([]);
  const [selectedDayId, setSelectedDayId] = useState<string | null>(null);
  const [publishing, setPublishing] = useState(false);
  const [applying, setApplying] = useState(false);
  const [buildTimedOut, setBuildTimedOut] = useState(false);

  const reload = useCallback(async () => {
    const res = await fetch(`/api/host/${encodeURIComponent(inviteCode)}/itinerary`);
    if (!res.ok) return 0;
    const body = await res.json();
    const loaded = (body.days ?? []) as ItineraryDay[];
    setDays(loaded);
    if (!selectedDayId && loaded[0]) setSelectedDayId(loaded[0].id);
    return loaded.length;
  }, [inviteCode, selectedDayId]);

  useEffect(() => {
    reload();
  }, [reload, tripId]);

  useEffect(() => {
    if (!building) return;

    setBuildTimedOut(false);
    const started = Date.now();
    const maxMs = 5 * 60 * 1000;

    const interval = window.setInterval(async () => {
      const count = await reload();
      if (count > 0) {
        window.clearInterval(interval);
        onBuildingDone?.();
      } else if (Date.now() - started > maxMs) {
        window.clearInterval(interval);
        setBuildTimedOut(true);
        onBuildingDone?.();
      }
    }, 2000);

    return () => window.clearInterval(interval);
  }, [building, onBuildingDone, reload]);

  const selectedDay = useMemo(
    () => days.find((d) => d.id === selectedDayId) ?? days[0] ?? null,
    [days, selectedDayId],
  );

  const dayItems = useMemo(() => {
    if (!selectedDay) return [];
    return sortItemsByStartTime(selectedDay.items);
  }, [selectedDay]);

  const totalItems = useMemo(
    () => days.reduce((n, d) => n + d.items.length, 0),
    [days],
  );

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
          {days.length > 0 ? (
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
          ) : null}
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={publish}
            disabled={publishing || totalItems === 0}
            className="h-9 rounded-lg bg-sky-700 px-3 text-xs font-medium text-white disabled:opacity-50"
          >
            {publishing ? "Publishing…" : "Publish"}
          </button>
        </div>
      </div>

      {building ? (
        <div className="border-b border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-950">
          <p className="font-medium">AI is building your itinerary…</p>
          <p className="mt-0.5 text-xs text-sky-800">
            {totalItems > 0
              ? `${days.length} day(s), ${totalItems} activities so far — updating live`
              : "Reading your document and creating days. This usually takes 30–90 seconds."}
          </p>
        </div>
      ) : null}

      {buildTimedOut && totalItems === 0 ? (
        <div className="border-b border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          Import is taking longer than expected. Open the AI editor to retry or attach your
          document again.
        </div>
      ) : null}

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

      <div className="mx-auto flex w-full max-w-md min-h-0 flex-1 flex-col overflow-hidden px-4 py-4">
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
        ) : building ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-zinc-300 border-t-zinc-900" />
            <p className="text-sm font-medium text-zinc-800">Building your trip…</p>
            <p className="max-w-xs text-xs text-zinc-500">
              Your schedule will appear here as soon as the AI finishes reading the document.
            </p>
          </div>
        ) : (
          <p className="text-sm text-zinc-600">
            Tap <span className="font-medium">AI editor</span> to add your document or describe
            changes.
          </p>
        )}
      </div>
    </div>
  );
}
