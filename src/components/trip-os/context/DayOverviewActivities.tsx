"use client";

import { useMemo, useState } from "react";
import { DateTime } from "luxon";

import { VenueNamePicker } from "@/components/geo/VenueNamePicker";
import { enumerateDates } from "@/lib/host/wizard/location-stays";
import type { ActivityDraft } from "@/lib/host/wizard/types";
import { newId } from "@/lib/host/wizard/types";
import type { TripCommand } from "@/lib/trip-engine/commands";
import { financeActivityLinesForDay } from "@/lib/trip-engine/cost-ledger/finance-section-readiness";
import type { CostLedgerProjection } from "@/lib/trip-engine/cost-ledger/types";
import { activitiesOnDate } from "@/lib/trip-engine/selectors";
import type { TripEntityGraph } from "@/lib/trip-engine/types";

import { AsyncButton } from "../shared/AsyncButton";
import { tripFieldClass, TripInput } from "../shared/TripInput";
import { TripPrimaryButton } from "../shared/TripPrimaryButton";
import { TripSoftPanel } from "../shared/TripSectionShell";

function ActivityAddressField(props: {
  value: string;
  onChange: (value: string) => void;
  countryNames: string[];
  cityHint?: string;
  onBlur?: () => void;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-zinc-700">Address (optional)</span>
      <VenueNamePicker
        value={props.value}
        onChange={props.onChange}
        onSelectVenue={({ address }) => {
          if (address) props.onChange(address);
        }}
        countryNames={props.countryNames}
        cityHint={props.cityHint}
        placeholder="Search or type an address…"
        inputClassName={tripFieldClass}
        onBlur={props.onBlur}
      />
      <p className="mt-1 text-[11px] text-zinc-400">
        For maps and student directions — does not affect setup status.
      </p>
    </label>
  );
}

function newActivityPayload(
  partial: Pick<ActivityDraft, "id" | "title" | "date" | "startTime" | "endTime" | "address">,
): ActivityDraft {
  return {
    id: partial.id,
    title: partial.title,
    date: partial.date,
    endDate: null,
    startTime: partial.startTime,
    endTime: partial.endTime,
    isTimeTbc: false,
    category: "activity",
    locationName: null,
    address: partial.address,
    isLocationTbc: true,
    transportNote: null,
    leaveByTime: null,
    bringNote: null,
    description: null,
    audienceType: "everyone",
    audienceId: null,
    bookingStatus: "not_booked",
  };
}

function activitySortKey(activity: ActivityDraft): string {
  if (activity.isTimeTbc || !activity.startTime?.trim()) return "99:99";
  return activity.startTime.slice(0, 5);
}

function formatActivityTime(activity: ActivityDraft): string {
  if (activity.isTimeTbc || !activity.startTime?.trim()) return "TBC";
  const start = activity.startTime.slice(0, 5);
  const end = activity.endTime?.trim()?.slice(0, 5);
  return end ? `${start}–${end}` : start;
}

function normalizeTime(value: string): string {
  const [h, m] = value.trim().split(":");
  return `${h!.padStart(2, "0")}:${m!.padStart(2, "0")}`;
}

type ActivityWithDate = ActivityDraft & { sortDate: string };

export function DayOverviewActivities(props: {
  graph: TripEntityGraph;
  groupId: string;
  rangeStart: string;
  rangeEnd: string;
  costLedger?: CostLedgerProjection | null;
  saving?: boolean;
  onDispatch: (commands: TripCommand[]) => Promise<boolean>;
}) {
  const [adding, setAdding] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [editingAddressId, setEditingAddressId] = useState<string | null>(null);
  const [addressDraft, setAddressDraft] = useState("");
  const [title, setTitle] = useState("");
  const [startTime, setStartTime] = useState("10:00");
  const [endTime, setEndTime] = useState("");
  const [address, setAddress] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  const countryNames = props.graph.basics.destinationCountries ?? [];
  const cityHint = useMemo(() => {
    const places = props.graph.dayPlacesByGroupId[props.groupId] ?? [];
    return places.find((place) => place.date === props.rangeStart)?.primaryCity ?? undefined;
  }, [props.graph.dayPlacesByGroupId, props.groupId, props.rangeStart]);

  const activitiesByDay = useMemo(() => {
    const end = props.rangeEnd || props.rangeStart;
    const items: ActivityWithDate[] = [];
    for (const iso of enumerateDates(props.rangeStart, end)) {
      for (const activity of activitiesOnDate(props.graph, iso)) {
        items.push({ ...activity, sortDate: iso });
      }
    }
    const seen = new Set<string>();
    const unique = items.filter((a) => {
      if (seen.has(a.id)) return false;
      seen.add(a.id);
      return true;
    });

    const byDay = new Map<string, ActivityWithDate[]>();
    for (const activity of unique) {
      const list = byDay.get(activity.sortDate) ?? [];
      list.push(activity);
      byDay.set(activity.sortDate, list);
    }

    return [...byDay.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([iso, dayActivities]) => [
        iso,
        dayActivities.sort((a, b) =>
          activitySortKey(a).localeCompare(activitySortKey(b)),
        ),
      ] as const);
  }, [props.graph, props.rangeStart, props.rangeEnd]);

  const activityCount = activitiesByDay.reduce((n, [, list]) => n + list.length, 0);
  const multiDay = props.rangeStart !== props.rangeEnd;

  const financeActivitySuggestions = useMemo(
    () => financeActivityLinesForDay(props.costLedger, props.graph, props.rangeStart),
    [props.costLedger, props.graph, props.rangeStart],
  );

  async function addActivityFromFinance(lineId: string, lineTitle: string) {
    setFormError(null);
    const normalizedStart = normalizeTime(startTime);
    const normalizedEnd = endTime.trim() ? normalizeTime(endTime) : null;
    const activityId = newId();
    const trimmedAddress = address.trim() || null;

    const ok = await props.onDispatch([
      {
        type: "addActivity",
        groupId: props.groupId,
        linkFinanceLineId: lineId,
        activity: newActivityPayload({
          id: activityId,
          title: lineTitle.trim(),
          date: props.rangeStart,
          startTime: normalizedStart,
          endTime: normalizedEnd,
          address: trimmedAddress,
        }),
      },
    ]);

    if (ok) {
      setTitle("");
      setStartTime("10:00");
      setEndTime("");
      setAddress("");
      setAdding(false);
    }
  }

  async function addActivity() {
    setFormError(null);
    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      setFormError("Add a title.");
      return;
    }
    if (!startTime.trim()) {
      setFormError("Choose a start time.");
      return;
    }
    const normalizedStart = normalizeTime(startTime);
    const normalizedEnd = endTime.trim() ? normalizeTime(endTime) : null;
    const trimmedAddress = address.trim() || null;

    const ok = await props.onDispatch([
      {
        type: "addActivity",
        groupId: props.groupId,
        activity: newActivityPayload({
          id: newId(),
          title: trimmedTitle,
          date: props.rangeStart,
          startTime: normalizedStart,
          endTime: normalizedEnd,
          address: trimmedAddress,
        }),
      },
    ]);

    if (ok) {
      setTitle("");
      setStartTime("10:00");
      setEndTime("");
      setAddress("");
      setAdding(false);
    }
  }

  function startEditingAddress(activity: ActivityDraft) {
    setEditingAddressId(activity.id);
    setAddressDraft(activity.address ?? "");
  }

  async function saveActivityAddress(activityId: string) {
    const activity = props.graph.activities.find((row) => row.id === activityId);
    if (!activity) {
      setEditingAddressId(null);
      return;
    }
    const nextAddress = addressDraft.trim() || null;
    if ((activity.address ?? null) === nextAddress) {
      setEditingAddressId(null);
      return;
    }
    const ok = await props.onDispatch([
      {
        type: "updateActivity",
        groupId: props.groupId,
        activityId,
        patch: { address: nextAddress },
      },
    ]);
    if (ok) setEditingAddressId(null);
  }

  async function removeActivity(activityId: string) {
    setRemovingId(activityId);
    try {
      await props.onDispatch([
        { type: "removeActivity", groupId: props.groupId, activityId },
      ]);
    } finally {
      setRemovingId(null);
    }
  }

  return (
    <section className="border-t border-zinc-100 pt-8">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h3 className="text-[11px] font-semibold uppercase tracking-[0.2em] text-zinc-400">
          Activities
        </h3>
        {!adding ? (
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="text-sm font-medium text-violet-600 hover:text-violet-700"
          >
            + Add
          </button>
        ) : null}
      </div>

      {adding ? (
        <TripSoftPanel title="New activity" className="mb-4">
          {financeActivitySuggestions.length > 0 ? (
            <div className="mb-4 rounded-xl border border-violet-200 bg-violet-50/80 px-3 py-3">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-violet-800">
                From Finance
              </p>
              <p className="mt-1 text-xs leading-relaxed text-violet-950">
                These are already in Finance for this day — add them to the calendar instead of
                creating a duplicate.
              </p>
              <ul className="mt-2 space-y-1">
                {financeActivitySuggestions.map((line) => (
                  <li key={line.id}>
                    <button
                      type="button"
                      disabled={props.saving}
                      onClick={() => void addActivityFromFinance(line.id, line.description)}
                      className="flex w-full items-center justify-between gap-2 rounded-lg border border-violet-200 bg-white px-3 py-2 text-left text-sm text-zinc-900 hover:border-violet-300 hover:bg-violet-50 disabled:opacity-50"
                    >
                      <span className="font-medium">{line.description}</span>
                      <span className="shrink-0 text-[10px] font-semibold uppercase tracking-wide text-violet-700">
                        Add to day
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          <div className="grid gap-2 sm:grid-cols-2">
            <TripInput
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Title"
              className="sm:col-span-2"
            />
            <TripInput
              type="time"
              step={300}
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
              label="Start time"
              required
            />
            <TripInput
              type="time"
              step={300}
              value={endTime}
              onChange={(e) => setEndTime(e.target.value)}
              label="End time (optional)"
            />
            <div className="sm:col-span-2">
              <ActivityAddressField
                value={address}
                onChange={setAddress}
                countryNames={countryNames}
                cityHint={cityHint}
              />
            </div>
          </div>
          {formError ? <p className="mt-2 text-sm text-red-600">{formError}</p> : null}
          <div className="mt-4 flex flex-wrap gap-2">
            <TripPrimaryButton onClick={() => void addActivity()} disabled={props.saving}>
              {props.saving ? "Adding…" : "Add activity"}
            </TripPrimaryButton>
            <button
              type="button"
              onClick={() => {
                setAdding(false);
                setFormError(null);
                setAddress("");
              }}
              className="rounded-full px-4 py-2 text-sm font-medium text-zinc-600 hover:bg-zinc-100"
            >
              Cancel
            </button>
          </div>
        </TripSoftPanel>
      ) : null}

      {activityCount ? (
        <div className="space-y-4">
          {activitiesByDay.map(([iso, dayActivities]) => (
            <div key={iso}>
              {multiDay || dayActivities.length > 0 ? (
                <p className="mb-1 text-xs font-semibold text-zinc-500">
                  {DateTime.fromISO(iso).toFormat("d MMM")}
                </p>
              ) : null}
              <ul className="divide-y divide-zinc-100">
                {dayActivities.map((activity) => (
                  <li key={activity.id} className="py-2">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex min-w-0 items-baseline gap-2 text-sm">
                          <span className="w-10 shrink-0 text-[11px] tabular-nums text-zinc-400">
                            {formatActivityTime(activity)}
                          </span>
                          <span className="min-w-0 truncate text-zinc-800">{activity.title}</span>
                          {activity.locationName ? (
                            <span className="hidden min-w-0 truncate text-xs text-zinc-400 sm:inline">
                              · {activity.locationName}
                            </span>
                          ) : null}
                        </div>
                        {editingAddressId === activity.id ? (
                          <div className="ml-12 mt-2 space-y-2">
                            <VenueNamePicker
                              value={addressDraft}
                              onChange={setAddressDraft}
                              onSelectVenue={({ address: picked }) => {
                                if (picked) setAddressDraft(picked);
                              }}
                              countryNames={countryNames}
                              cityHint={cityHint}
                              placeholder="Search or type an address…"
                              inputClassName={tripFieldClass}
                              onBlur={() => void saveActivityAddress(activity.id)}
                            />
                            <div className="flex flex-wrap gap-2">
                              <button
                                type="button"
                                onClick={() => void saveActivityAddress(activity.id)}
                                className="rounded-full bg-violet-600 px-3 py-1 text-xs font-medium text-white hover:bg-violet-700"
                              >
                                Save address
                              </button>
                              <button
                                type="button"
                                onClick={() => setEditingAddressId(null)}
                                className="rounded-full px-3 py-1 text-xs font-medium text-zinc-600 hover:bg-zinc-100"
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        ) : activity.address?.trim() ? (
                          <button
                            type="button"
                            onClick={() => startEditingAddress(activity)}
                            className="ml-12 mt-0.5 block max-w-full truncate text-left text-xs text-zinc-400 hover:text-zinc-600"
                            title={activity.address}
                          >
                            {activity.address}
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => startEditingAddress(activity)}
                            className="ml-12 mt-0.5 text-xs font-medium text-violet-600 hover:text-violet-700"
                          >
                            + Add address
                          </button>
                        )}
                      </div>
                      <AsyncButton
                        loading={removingId === activity.id}
                        loadingLabel="…"
                        onClick={() => void removeActivity(activity.id)}
                        className="shrink-0 text-xs text-zinc-400 hover:text-red-600"
                      >
                        Remove
                      </AsyncButton>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm text-zinc-400">No activities in this range.</p>
      )}
    </section>
  );
}
