"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { DateTime } from "luxon";

import { CompactDaySheet } from "@/components/student/today/CompactDaySheet";
import { ActivityItemPanel } from "@/components/host/itinerary/ActivityItemPanel";
import type { ItineraryItem, RosterSummary } from "@/components/host/itinerary/types";
import { hostJson } from "@/components/host/shared/host-fetch";
import { resolveDefaultTodayDate } from "@/lib/ai/change-scope";
import { sortItemsByStartTime } from "@/lib/timeline/time-math";
import type { TripImportProgress } from "@/types/trip-import-progress";

import {
  stayColor,
  stayForNight,
} from "@/lib/host/locations/accommodation-colors";
import type { ImportGap } from "@/lib/host/wizard/analyze-import-gaps";
import type { AccommodationStayDraft } from "@/lib/host/wizard/types";

import { BuildingGhostRow } from "./BuildingGhostRow";
import { TripGapsPanel } from "./TripGapsPanel";
import { PublishSuccessModal } from "./PublishSuccessModal";
import { StudentTodayPreviewShell } from "./StudentTodayPreviewShell";

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
  items: ItineraryItem[];
  prep: Array<{ id: string; text: string }>;
};

function formatTripDate(iso: string) {
  return new Date(`${iso}T12:00:00`).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function buildStatusLine(progress: TripImportProgress | null) {
  if (!progress) return null;
  switch (progress.type) {
    case "phase":
      if (progress.phase === "reading") return "Reading your document…";
      if (progress.phase === "planning") return "Planning trip dates and day structure…";
      if (progress.phase === "structure") return "Extracting flights, cities, and hotels…";
      if (progress.phase === "structure_applied") return "Trip structure saved — adding activities…";
      return "Building your itinerary day by day…";
    case "trip_dates":
      return `Trip set: ${formatTripDate(progress.startDate)} → ${formatTripDate(progress.endDate)} (${progress.dayCount} days)`;
    case "day_start":
      return `Building day ${progress.index} of ${progress.total}: ${formatTripDate(progress.date)} — ${progress.cityLabel}`;
    case "item_added":
      return `Adding activity ${progress.index} of ${progress.total}…`;
    case "day_complete":
      return `Finished ${formatTripDate(progress.date)} (${progress.itemCount} activities)`;
    default:
      return null;
  }
}

export function LivePreviewPanel(props: {
  tripId: string;
  tripName: string;
  inviteCode: string;
  timezone: string;
  startDate: string;
  endDate?: string;
  building?: boolean;
  buildProgress?: TripImportProgress | null;
  onBuildingDone?: () => void;
}) {
  const {
    tripId,
    tripName,
    inviteCode,
    timezone,
    startDate,
    endDate,
    building,
    buildProgress,
    onBuildingDone,
  } = props;
  const [days, setDays] = useState<ItineraryDay[]>([]);
  const [selectedDayId, setSelectedDayId] = useState<string | null>(null);
  const [publishing, setPublishing] = useState(false);
  const [publishResult, setPublishResult] = useState<{
    version: number;
    links: {
      hostTrip: { url: string; path: string };
      studentInvite: { url: string; path: string };
    };
  } | null>(null);
  const [buildTimedOut, setBuildTimedOut] = useState(false);
  const [revealedIds, setRevealedIds] = useState<Set<string>>(() => new Set());
  const [typingId, setTypingId] = useState<string | null>(null);
  const [ghostItem, setGhostItem] = useState<{
    title: string;
    category: string | null;
  } | null>(null);
  const [importGaps, setImportGaps] = useState<ImportGap[]>([]);
  const [accommodationStays, setAccommodationStays] = useState<AccommodationStayDraft[]>([]);
  const [destinationCountries, setDestinationCountries] = useState<string[]>([]);
  const [roster, setRoster] = useState<RosterSummary>({
    rooms: [],
    groups: [],
    participants: [],
  });
  const [activitySheet, setActivitySheet] = useState<
    { mode: "add" | "edit"; item: ItineraryItem | null } | null
  >(null);
  const [activityError, setActivityError] = useState<string | null>(null);
  const knownIdsRef = useRef<Set<string>>(new Set());
  const revealTimersRef = useRef<number[]>([]);
  const didPickInitialDayRef = useRef(false);

  const reload = useCallback(async () => {
    const [itineraryRes, gapsRes, locRes, rosterRes] = await Promise.all([
      fetch(`/api/host/${encodeURIComponent(inviteCode)}/itinerary`),
      fetch(`/api/trips/${tripId}/gaps`),
      fetch(`/api/trips/${tripId}/locations`),
      fetch(`/api/host/${encodeURIComponent(inviteCode)}/roster`),
    ]);
    if (gapsRes.ok) {
      const gapsBody = await gapsRes.json();
      setImportGaps(gapsBody.gaps ?? []);
    }
    if (locRes.ok) {
      const locBody = await locRes.json();
      setAccommodationStays(locBody.state?.accommodationStays ?? []);
      setDestinationCountries(locBody.state?.basics?.destinationCountries ?? []);
    }
    if (rosterRes.ok) {
      const rosterBody = await rosterRes.json();
      setRoster({
        rooms: rosterBody.rooms ?? [],
        groups: rosterBody.groups ?? [],
        participants: rosterBody.participants ?? [],
      });
    }
    if (!itineraryRes.ok) return 0;
    const body = await itineraryRes.json();
    const loaded = (body.days ?? []) as ItineraryDay[];
    setDays(loaded);
    if (!didPickInitialDayRef.current && loaded.length) {
      didPickInitialDayRef.current = true;
      const todayDate = resolveDefaultTodayDate(
        timezone,
        startDate,
        endDate ?? startDate,
      );
      const todayDay = loaded.find((d) => d.date === todayDate);
      setSelectedDayId((todayDay ?? loaded[0])!.id);
    }
    return loaded.length;
  }, [inviteCode, timezone, startDate, endDate, tripId]);

  useEffect(() => {
    reload();
  }, [reload, tripId]);

  useEffect(() => {
    if (!building) {
      setRevealedIds(new Set());
      setTypingId(null);
      setGhostItem(null);
      knownIdsRef.current = new Set();
      for (const id of revealTimersRef.current) window.clearTimeout(id);
      revealTimersRef.current = [];
      return;
    }

    setBuildTimedOut(false);
    const started = Date.now();
    const maxMs = 10 * 60 * 1000;

    const interval = window.setInterval(async () => {
      await reload();
      if (Date.now() - started > maxMs) {
        window.clearInterval(interval);
        setBuildTimedOut(true);
        onBuildingDone?.();
      }
    }, 600);

    return () => window.clearInterval(interval);
  }, [building, onBuildingDone, reload]);

  useEffect(() => {
    if (!buildProgress) return;
    if (buildProgress.type === "gaps") {
      setImportGaps(buildProgress.gaps);
    }
    if (buildProgress.type === "done" && buildProgress.gaps?.length) {
      setImportGaps(buildProgress.gaps);
    }
  }, [buildProgress]);

  useEffect(() => {
    if (!building || !buildProgress) return;

    if (buildProgress.type === "day_start") {
      setGhostItem(null);
      const match = days.find((d) => d.date === buildProgress.date);
      if (match) setSelectedDayId(match.id);
    }

    if (buildProgress.type === "item_added") {
      setGhostItem({
        title: buildProgress.title,
        category: buildProgress.category,
      });
      const match = days.find((d) => d.date === buildProgress.date);
      if (match) setSelectedDayId(match.id);
    }
  }, [buildProgress, building, days]);

  useEffect(() => {
    if (!building) return;

    const newItems = days.flatMap((day) =>
      day.items
        .filter((item) => !knownIdsRef.current.has(item.id))
        .map((item) => ({ item, dayId: day.id })),
    );

    if (!newItems.length) return;

    newItems.forEach(({ item, dayId }, idx) => {
      const timer = window.setTimeout(() => {
        knownIdsRef.current.add(item.id);
        setRevealedIds((prev) => new Set([...prev, item.id]));
        setTypingId(item.id);
        setGhostItem(null);
        setSelectedDayId(dayId);
      }, idx * 220);
      revealTimersRef.current.push(timer);
    });
  }, [days, building]);

  const selectedDay = useMemo(
    () => days.find((d) => d.id === selectedDayId) ?? days[0] ?? null,
    [days, selectedDayId],
  );

  const dayItems = useMemo(() => {
    if (!selectedDay) return [];
    const sorted = sortItemsByStartTime(selectedDay.items);
    if (!building) return sorted;
    return sorted.filter((item) => revealedIds.has(item.id));
  }, [selectedDay, building, revealedIds]);

  const totalItems = useMemo(
    () => days.reduce((n, d) => n + d.items.length, 0),
    [days],
  );

  const itemCountByDayId = useMemo(() => {
    const m = new Map<string, number>();
    for (const day of days) m.set(day.id, day.items.length);
    return m;
  }, [days]);

  const firstItemTitleByDayId = useMemo(() => {
    const m = new Map<string, string>();
    for (const day of days) {
      const first = sortItemsByStartTime(day.items)[0];
      if (first) m.set(day.id, first.title);
    }
    return m;
  }, [days]);

  const todayISO = useMemo(
    () => DateTime.now().setZone(timezone).toISODate(),
    [timezone],
  );

  const isViewingToday = Boolean(
    selectedDay && todayISO && selectedDay.date === todayISO,
  );

  const previewNightStay = useMemo(() => {
    if (!selectedDay) return null;
    const stay = stayForNight(selectedDay.date, accommodationStays);
    if (!stay) return null;
    return {
      name: stay.name,
      color: stayColor(stay),
    };
  }, [selectedDay, accommodationStays]);

  const statusLine = buildStatusLine(buildProgress ?? null);
  const tripRange =
    endDate && startDate
      ? `${formatTripDate(startDate)} → ${formatTripDate(endDate)}`
      : null;

  async function publish() {
    setPublishing(true);
    try {
      const res = await fetch(`/api/trips/${tripId}/publish`, { method: "POST" });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || "Publish failed");
      if (body.links && body.version) {
        setPublishResult({ version: body.version, links: body.links });
      }
    } finally {
      setPublishing(false);
    }
  }

  function applySavedItem(dayId: string, saved: ItineraryItem, mode: "add" | "edit") {
    setDays((prev) =>
      prev.map((d) => {
        if (d.id !== dayId) return d;
        if (mode === "add") {
          return { ...d, items: [...d.items, saved] };
        }
        return {
          ...d,
          items: d.items.map((i) => (i.id === saved.id ? { ...i, ...saved } : i)),
        };
      }),
    );
  }

  async function deleteActivity(id: string) {
    if (!confirm("Delete this activity?")) return;
    const snapshot = days;
    setDays((prev) =>
      prev.map((d) => ({
        ...d,
        items: d.items.filter((i) => i.id !== id),
      })),
    );
    setActivitySheet(null);
    try {
      await hostJson(`/api/host/${encodeURIComponent(inviteCode)}/items/${id}`, {
        method: "DELETE",
      });
    } catch (err) {
      setDays(snapshot);
      setActivityError(err instanceof Error ? err.message : "Delete failed");
    }
  }

  function openEditActivity(itemId: string) {
    const day = selectedDay;
    if (!day) return;
    const item = day.items.find((i) => i.id === itemId);
    if (!item) return;
    setActivityError(null);
    setActivitySheet({ mode: "edit", item });
  }

  return (
    <div className="flex h-full min-h-0 flex-col bg-zinc-50">
      <div className="flex items-center justify-between border-b border-zinc-200 px-4 py-3">
        <div>
          <h2 className="text-sm font-semibold">Live preview</h2>
          <p className="mt-0.5 text-xs text-zinc-500">
            Matches the student Today screen
          </p>
          {!days.length && tripRange ? (
            <p className="mt-1 text-xs text-zinc-600">{tripRange}</p>
          ) : null}
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={publish}
            disabled={publishing || totalItems === 0 || importGaps.length > 0}
            className="h-9 rounded-lg bg-sky-700 px-3 text-xs font-medium text-white disabled:opacity-50"
            title={importGaps.length > 0 ? "Resolve gaps in Locations first" : undefined}
          >
            {publishing ? "Publishing…" : "Publish"}
          </button>
        </div>
      </div>

      {building ? (
        <div className="border-b border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-950">
          <p className="font-medium">AI is building your itinerary…</p>
          <p className="mt-0.5 text-xs text-sky-800">
            {statusLine ??
              (totalItems > 0
                ? `${days.length} day(s), ${totalItems} activities so far`
                : "Deciding trip dates, then filling in each day.")}
          </p>
        </div>
      ) : null}

      {buildTimedOut && totalItems === 0 ? (
        <div className="border-b border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          Import is taking longer than expected. Open the AI editor to retry or attach your
          document again.
        </div>
      ) : null}

      <div className="flex min-h-0 flex-1 overflow-hidden">
        <div className="flex min-h-0 min-w-0 flex-1 items-start justify-center gap-3 overflow-hidden bg-zinc-100/80 px-3 py-4">
          <div className="flex h-full min-h-0 max-h-full w-full max-w-md shrink-0 flex-col overflow-hidden">
            <StudentTodayPreviewShell
              timezone={timezone}
              startDate={startDate}
              endDate={endDate}
              days={days}
              selectedDayId={selectedDay?.id ?? null}
              onSelectDayId={setSelectedDayId}
              itemCountByDayId={itemCountByDayId}
              firstItemTitleByDayId={firstItemTitleByDayId}
              nightStay={previewNightStay}
            >
              {selectedDay ? (
                <CompactDaySheet
                  items={dayItems}
                  prepItems={selectedDay.prep}
                  tripTimezone={timezone}
                  dateISO={selectedDay.date}
                  cityLabel={selectedDay.cityLabel}
                  weather={selectedDay.weather}
                  tripStartDate={startDate}
                  isViewingToday={isViewingToday}
                  mapsOnline
                  animateItemIds={building ? revealedIds : undefined}
                  typewriterItemId={building ? typingId : null}
                  buildingEmptyLabel={
                    building ? "Building this day's activities…" : null
                  }
                  nightStay={previewNightStay}
                  hostEditing={
                    building
                      ? undefined
                      : {
                          onEditItem: (item) => openEditActivity(item.id),
                        }
                  }
                  listFooter={
                    building && ghostItem ? (
                      <BuildingGhostRow
                        title={ghostItem.title}
                        category={ghostItem.category}
                      />
                    ) : null
                  }
                />
              ) : building ? (
                <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center">
                  <div className="h-8 w-8 animate-spin rounded-full border-2 border-zinc-300 border-t-zinc-900" />
                  <p className="text-sm font-medium text-zinc-800">
                    {buildProgress?.type === "trip_dates"
                      ? `Planning ${buildProgress.dayCount} days…`
                      : "Planning your trip…"}
                  </p>
                  <p className="max-w-xs text-xs text-zinc-500">
                    {tripRange
                      ? `${tripRange} — activities will appear day by day.`
                      : "Trip dates first, then each day fills in with colored activity blocks."}
                  </p>
                </div>
              ) : (
                <p className="py-10 text-center text-sm text-zinc-600">
                  Pick a day in the preview.
                </p>
              )}
            </StudentTodayPreviewShell>
          </div>

          {!building && selectedDay ? (
            <div className="flex shrink-0 flex-col items-start gap-3 self-center">
              <button
                type="button"
                onClick={() => {
                  setActivityError(null);
                  setActivitySheet({ mode: "add", item: null });
                }}
                aria-label="Add activity"
                className="flex h-11 w-11 items-center justify-center rounded-full bg-zinc-900 text-2xl font-light leading-none text-white shadow-lg hover:bg-zinc-800"
              >
                +
              </button>
              <ActivityItemPanel
                open={Boolean(activitySheet)}
                mode={activitySheet?.mode ?? "add"}
                item={activitySheet?.item ?? null}
                inviteCode={inviteCode}
                dayId={selectedDay.id}
                roster={roster}
                countryNames={destinationCountries}
                cityHint={selectedDay.cityLabel.split(/[→,]/)[0]?.trim()}
                onClose={() => setActivitySheet(null)}
                onSaved={(item) => {
                  if (item && selectedDay && activitySheet) {
                    applySavedItem(selectedDay.id, item, activitySheet.mode);
                  }
                  setActivitySheet(null);
                }}
                onDelete={deleteActivity}
                onError={setActivityError}
              />
            </div>
          ) : null}
        </div>

        {!building && importGaps.length > 0 ? (
          <TripGapsPanel gaps={importGaps} tripId={tripId} />
        ) : null}
      </div>

      {activityError ? (
        <div className="absolute bottom-4 left-1/2 z-50 -translate-x-1/2 rounded-lg bg-red-600 px-3 py-2 text-xs text-white shadow-lg">
          {activityError}
        </div>
      ) : null}

      {publishResult ? (
        <PublishSuccessModal
          version={publishResult.version}
          links={publishResult.links}
          tripName={tripName}
          onClose={() => setPublishResult(null)}
        />
      ) : null}
    </div>
  );
}
