"use client";

import { useMemo, useState } from "react";
import { DateTime } from "luxon";

import { enumerateDates } from "@/lib/host/wizard/location-stays";
import type { ActivityDraft } from "@/lib/host/wizard/types";
import { newId } from "@/lib/host/wizard/types";
import type { TripCommand } from "@/lib/trip-engine/commands";
import { activitiesOnDate } from "@/lib/trip-engine/selectors";
import type { TripEntityGraph } from "@/lib/trip-engine/types";

import { AsyncButton } from "../shared/AsyncButton";
import { TripInput } from "../shared/TripInput";
import { TripPrimaryButton } from "../shared/TripPrimaryButton";
import { TripSoftPanel } from "../shared/TripSectionShell";

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

function isValidStartTime(value: string): boolean {
  return /^\d{1,2}:\d{2}$/.test(value.trim());
}

function normalizeStartTime(value: string): string {
  const [h, m] = value.trim().split(":");
  return `${h!.padStart(2, "0")}:${m!.padStart(2, "0")}`;
}

type ActivityWithDate = ActivityDraft & { sortDate: string };

export function DayOverviewActivities(props: {
  graph: TripEntityGraph;
  groupId: string;
  rangeStart: string;
  rangeEnd: string;
  saving?: boolean;
  onDispatch: (commands: TripCommand[]) => Promise<boolean>;
}) {
  const [adding, setAdding] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [startTime, setStartTime] = useState("10:00");
  const [endTime, setEndTime] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

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

  async function addActivity() {
    setFormError(null);
    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      setFormError("Add a title.");
      return;
    }
    if (!isValidStartTime(startTime)) {
      setFormError("Start time is required (e.g. 10:00).");
      return;
    }
    const normalizedStart = normalizeStartTime(startTime);
    const normalizedEnd = endTime.trim() && isValidStartTime(endTime)
      ? normalizeStartTime(endTime)
      : null;

    const ok = await props.onDispatch([
      {
        type: "addActivity",
        groupId: props.groupId,
        activity: {
          id: newId(),
          title: trimmedTitle,
          date: props.rangeStart,
          endDate: null,
          startTime: normalizedStart,
          endTime: normalizedEnd,
          isTimeTbc: false,
          category: "activity",
          locationName: null,
          address: null,
          isLocationTbc: true,
          transportNote: null,
          leaveByTime: null,
          bringNote: null,
          description: null,
          audienceType: "everyone",
          audienceId: null,
          bookingStatus: "not_booked",
        },
      },
    ]);

    if (ok) {
      setTitle("");
      setStartTime("10:00");
      setEndTime("");
      setAdding(false);
    }
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
          <div className="grid gap-2 sm:grid-cols-2">
            <TripInput
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Title"
              className="sm:col-span-2"
            />
            <TripInput
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
              placeholder="Start time (required)"
              aria-required
            />
            <TripInput
              value={endTime}
              onChange={(e) => setEndTime(e.target.value)}
              placeholder="End time (optional)"
            />
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
                  <li
                    key={activity.id}
                    className="flex items-baseline justify-between gap-3 py-1.5"
                  >
                    <div className="min-w-0 flex items-baseline gap-2 text-sm">
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
                    <AsyncButton
                      loading={removingId === activity.id}
                      loadingLabel="…"
                      onClick={() => void removeActivity(activity.id)}
                      className="shrink-0 text-xs text-zinc-400 hover:text-red-600"
                    >
                      Remove
                    </AsyncButton>
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
