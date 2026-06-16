"use client";

import { useMemo, useState } from "react";

import { TimeInput } from "@/components/ui/TimeInput";
import type { TripSetupState } from "@/lib/host/setup/types";
import { formatTimeDisplay } from "@/lib/utils/time-input";
import { newId } from "@/lib/host/wizard/types";
import type { ActivityDraft } from "@/lib/host/wizard/types";

import { SetupAddsPanel } from "./SetupAddsPanel";
import type { CalendarSelection } from "./use-setup-calendar";

type AddKind = "activity" | "reminder" | "meeting";

function inRange(date: string, start: string, end: string): boolean {
  const e = end || start;
  return date >= start && date <= e;
}

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

export function SetupDayAddsPanel(props: {
  state: TripSetupState;
  selection: CalendarSelection;
  onChange: (next: TripSetupState) => void;
  /** Clear calendar selection after the user confirms an add. */
  onConfirmed?: () => void;
  /** Full-workspace activities tab — no Adds chrome or reminder/meeting toggles. */
  embedded?: boolean;
}) {
  const { state, selection, onChange, onConfirmed, embedded = false } = props;
  const { rangeStart, rangeEnd } = selection;
  const end = rangeEnd || rangeStart || "";
  const [kind, setKind] = useState<AddKind>("activity");
  const [title, setTitle] = useState("");
  const [startTime, setStartTime] = useState<string | null>(null);

  const activitiesOnRange = useMemo(() => {
    if (!rangeStart) return [];
    return state.activities
      .filter((a) => inRange(a.date, rangeStart, end))
      .sort(compareBySchedule);
  }, [state.activities, rangeStart, end]);

  function addActivity() {
    if (!rangeStart || !title.trim()) return;
    const act: ActivityDraft = {
      id: newId(),
      title: title.trim(),
      date: rangeStart,
      endDate: rangeStart !== end ? end : null,
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
    onConfirmed?.();
  }

  function removeActivity(id: string) {
    onChange({ ...state, activities: state.activities.filter((a) => a.id !== id) });
  }

  const kinds: Array<{ id: AddKind; label: string; ready: boolean }> = [
    { id: "activity", label: "Activity", ready: true },
    { id: "reminder", label: "Reminder", ready: false },
    { id: "meeting", label: "Meeting", ready: false },
  ];

  const activityContent = (
          <div className="space-y-4">
            {activitiesOnRange.length ? (
              <ul className="space-y-2">
                {activitiesOnRange.map((act) => (
                  <li
                    key={act.id}
                    className="flex items-center justify-between gap-2 rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm"
                  >
                    <span className="min-w-0 truncate">
                      {act.startTime ? `${formatTimeDisplay(act.startTime)} · ` : ""}
                      {act.title}
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
              <p className="text-sm text-zinc-500">No activities on these days yet.</p>
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
                  disabled={!title.trim()}
                  onClick={addActivity}
                  className="h-10 rounded-lg bg-zinc-900 px-5 text-sm font-bold text-white disabled:opacity-40"
                >
                  Add activity
                </button>
              </div>
            </div>
          </div>
  );

  if (embedded) {
    return activityContent;
  }

  return (
    <SetupAddsPanel
      headerExtra={
        <div className="flex flex-wrap gap-2">
          {kinds.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setKind(item.id)}
              className={[
                "rounded-lg px-3 py-1.5 text-xs font-medium transition",
                kind === item.id
                  ? "bg-zinc-900 text-white"
                  : "border border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50",
              ].join(" ")}
            >
              {item.label}
            </button>
          ))}
        </div>
      }
    >
      {kind === "activity" ? (
        activityContent
      ) : (
        <p className="text-sm text-zinc-500">
          {kind === "reminder" ? "Reminders" : "Meetings"} coming soon — use the left nav section
          for now.
        </p>
      )}
    </SetupAddsPanel>
  );
}
