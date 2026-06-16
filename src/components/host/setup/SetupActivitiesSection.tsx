"use client";

import { useMemo, useState } from "react";

import { TimeInput } from "@/components/ui/TimeInput";
import { activitiesStatusItems } from "@/lib/host/setup/section-status-items";
import type { TripSetupState } from "@/lib/host/setup/types";
import { formatTimeDisplay } from "@/lib/utils/time-input";
import { newId } from "@/lib/host/wizard/types";
import type { ActivityDraft } from "@/lib/host/wizard/types";

import { SetupAddsPanel } from "./SetupAddsPanel";
import { SetupSectionSplit } from "./SetupSectionSplit";
import { SetupSectionStatusPanel } from "./SetupSectionStatusPanel";

function compareBySchedule(
  a: { date: string; startTime: string | null; title: string },
  b: { date: string; startTime: string | null; title: string },
): number {
  const dateCmp = a.date.localeCompare(b.date);
  if (dateCmp !== 0) return dateCmp;
  if (!a.startTime && !b.startTime) return a.title.localeCompare(b.title);
  if (!a.startTime) return 1;
  if (!b.startTime) return -1;
  const timeCmp = a.startTime.localeCompare(b.startTime);
  return timeCmp !== 0 ? timeCmp : a.title.localeCompare(b.title);
}

export function SetupActivitiesSection(props: {
  state: TripSetupState;
  sectionLabel?: string;
  sectionMessage?: string;
  onChange: (next: TripSetupState) => void;
}) {
  const { state, sectionLabel, sectionMessage, onChange } = props;
  const [title, setTitle] = useState("");
  const [date, setDate] = useState(state.basics.startDate || "");
  const [startTime, setStartTime] = useState<string | null>(null);

  const statusItems = useMemo(() => activitiesStatusItems(state), [state]);
  const sortedActivities = useMemo(
    () => [...state.activities].sort(compareBySchedule),
    [state.activities],
  );

  function addActivity() {
    if (!title.trim() || !date) return;
    const act: ActivityDraft = {
      id: newId(),
      title: title.trim(),
      date,
      endDate: null,
      startTime: startTime || null,
      endTime: null,
      isTimeTbc: !startTime,
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
    };
    onChange({ ...state, activities: [...state.activities, act] });
    setTitle("");
    setStartTime(null);
  }

  function removeActivity(id: string) {
    onChange({ ...state, activities: state.activities.filter((a) => a.id !== id) });
  }

  return (
    <SetupSectionSplit
      status={
        <SetupSectionStatusPanel
          section={
            sectionLabel
              ? { id: "activities", label: sectionLabel, status: "todo", message: sectionMessage }
              : undefined
          }
          items={statusItems}
        />
      }
      adds={
        <SetupAddsPanel>
          <div className="space-y-4">
            {sortedActivities.length ? (
              <ul className="space-y-2">
                {sortedActivities.map((act) => (
                  <li
                    key={act.id}
                    className="flex items-center justify-between gap-2 rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm"
                  >
                    <span className="min-w-0 truncate">
                      {act.date}
                      {act.startTime ? ` · ${formatTimeDisplay(act.startTime)}` : ""} · {act.title}
                    </span>
                    <button
                      type="button"
                      onClick={() => removeActivity(act.id)}
                      className="shrink-0 text-xs text-red-600 hover:underline"
                    >
                      Remove
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-zinc-500">No activities yet.</p>
            )}

            <div className="space-y-3 rounded-lg border border-zinc-200 bg-white p-3">
              <h3 className="text-sm font-medium text-zinc-900">Add activity</h3>
              <label className="block text-sm">
                <span className="font-medium text-zinc-700">Title</span>
                <input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. TeamLab visit"
                  className="mt-1.5 h-10 w-full rounded-lg border border-zinc-200 px-3 text-sm"
                />
              </label>
              <label className="block text-sm">
                <span className="font-medium text-zinc-700">Date</span>
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="mt-1.5 h-10 w-full rounded-lg border border-zinc-200 px-3 text-sm"
                />
              </label>
              <label className="block text-sm">
                <span className="font-medium text-zinc-700">Start time</span>
                <TimeInput
                  value={startTime}
                  onChange={setStartTime}
                  placeholder="Pick a time"
                  className="mt-1.5"
                  inputClassName="h-10 w-full rounded-lg border border-zinc-200 bg-white px-3 text-sm shadow-none focus:ring-2 focus:ring-zinc-100"
                />
              </label>
              <div className="flex justify-end pt-1">
                <button
                  type="button"
                  disabled={!title.trim() || !date}
                  onClick={addActivity}
                  className="h-10 rounded-lg bg-zinc-900 px-5 text-sm font-bold text-white disabled:opacity-40"
                >
                  Add activity
                </button>
              </div>
            </div>
          </div>
        </SetupAddsPanel>
      }
    />
  );
}
