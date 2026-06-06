"use client";

import { PlacePicker } from "@/components/geo/PlacePicker";
import { ACTIVITY_CATEGORIES, type ActivityCategory } from "@/types/activity-category";
import type { ActivityDraft, ReminderDraft, TripWizardDraft } from "@/lib/host/wizard/types";
import { BOOKING_STATUSES, newId } from "@/lib/host/wizard/types";

export function ActivitiesStep({
  draft,
  onChange,
}: {
  draft: TripWizardDraft;
  onChange: (draft: TripWizardDraft) => void;
}) {
  function addActivity() {
    const act: ActivityDraft = {
      id: newId(),
      title: "",
      date: draft.basics.startDate || "",
      endDate: null,
      startTime: null,
      endTime: null,
      isTimeTbc: true,
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
    onChange({ ...draft, activities: [...draft.activities, act] });
  }

  function updateActivity(i: number, patch: Partial<ActivityDraft>) {
    onChange({
      ...draft,
      activities: draft.activities.map((a, j) => (j === i ? { ...a, ...patch } : a)),
    });
  }

  function addReminder() {
    const rem: ReminderDraft = {
      id: newId(),
      date: draft.basics.startDate || "",
      title: "",
      reminderTime: null,
      note: null,
      audienceType: "everyone",
      audienceId: null,
    };
    onChange({ ...draft, reminders: [...draft.reminders, rem] });
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Activities</h2>
        <p className="text-sm text-zinc-600">Add activities to your itinerary shell.</p>
        <div className="mt-4 space-y-4">
          {draft.activities.map((act, i) => (
            <div key={act.id} className="rounded-xl border border-zinc-200 p-4 space-y-2">
              <div className="flex justify-between">
                <span className="text-sm font-medium">Activity</span>
                <button
                  type="button"
                  className="text-xs text-red-600"
                  onClick={() =>
                    onChange({
                      ...draft,
                      activities: draft.activities.filter((_, j) => j !== i),
                    })
                  }
                >
                  Remove
                </button>
              </div>
              <input
                value={act.title}
                onChange={(e) => updateActivity(i, { title: e.target.value })}
                placeholder="Activity name"
                className="h-10 w-full rounded-lg border border-zinc-200 px-2 text-sm"
              />
              <div className="grid gap-2 sm:grid-cols-2">
                <input
                  type="date"
                  value={act.date}
                  onChange={(e) => updateActivity(i, { date: e.target.value })}
                  className="h-10 rounded-lg border border-zinc-200 px-2 text-sm"
                />
                <select
                  value={act.category}
                  onChange={(e) =>
                    updateActivity(i, { category: e.target.value as ActivityCategory })
                  }
                  className="h-10 rounded-lg border border-zinc-200 px-2 text-sm"
                >
                  {ACTIVITY_CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {c.replace(/_/g, " ")}
                    </option>
                  ))}
                </select>
              </div>
              <label className="flex items-center gap-2 text-xs">
                <input
                  type="checkbox"
                  checked={act.isTimeTbc}
                  onChange={(e) => updateActivity(i, { isTimeTbc: e.target.checked })}
                />
                Time TBC
              </label>
              {!act.isTimeTbc ? (
                <input
                  type="time"
                  value={act.startTime ?? ""}
                  onChange={(e) => updateActivity(i, { startTime: e.target.value || null })}
                  className="h-10 w-full rounded-lg border border-zinc-200 px-2 text-sm"
                />
              ) : null}
              <label className="flex items-center gap-2 text-xs">
                <input
                  type="checkbox"
                  checked={act.isLocationTbc}
                  onChange={(e) => updateActivity(i, { isLocationTbc: e.target.checked })}
                />
                Location TBC
              </label>
              {!act.isLocationTbc ? (
                <PlacePicker
                  value={act.locationName ?? ""}
                  onChange={(locationName) =>
                    updateActivity(i, { locationName: locationName || null })
                  }
                  placeholder="Venue or address"
                  countryNames={draft.basics.destinationCountries}
                  inputClassName="h-10 w-full rounded-lg border border-zinc-200 px-2 text-sm focus:border-zinc-400 focus:outline-none"
                />
              ) : null}
              <select
                value={act.bookingStatus}
                onChange={(e) =>
                  updateActivity(i, {
                    bookingStatus: e.target.value as ActivityDraft["bookingStatus"],
                  })
                }
                className="h-10 w-full rounded-lg border border-zinc-200 px-2 text-sm"
              >
                {BOOKING_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s.replace(/_/g, " ")}
                  </option>
                ))}
              </select>
            </div>
          ))}
          <button type="button" onClick={addActivity} className="text-sm font-medium underline">
            + Add activity
          </button>
        </div>
      </div>

      <div>
        <h3 className="font-medium">Reminders</h3>
        <p className="text-sm text-zinc-600">Lightweight sub-activities like pack bags or call home.</p>
        <div className="mt-3 space-y-2">
          {draft.reminders.map((rem, i) => (
            <div key={rem.id} className="flex gap-2">
              <input
                type="date"
                value={rem.date}
                onChange={(e) =>
                  onChange({
                    ...draft,
                    reminders: draft.reminders.map((r, j) =>
                      j === i ? { ...r, date: e.target.value } : r,
                    ),
                  })
                }
                className="h-9 w-36 rounded-lg border border-zinc-200 px-2 text-sm"
              />
              <input
                value={rem.title}
                onChange={(e) =>
                  onChange({
                    ...draft,
                    reminders: draft.reminders.map((r, j) =>
                      j === i ? { ...r, title: e.target.value } : r,
                    ),
                  })
                }
                placeholder="Reminder"
                className="h-9 flex-1 rounded-lg border border-zinc-200 px-2 text-sm"
              />
              <button
                type="button"
                className="text-xs text-red-600"
                onClick={() =>
                  onChange({
                    ...draft,
                    reminders: draft.reminders.filter((_, j) => j !== i),
                  })
                }
              >
                ×
              </button>
            </div>
          ))}
          <button type="button" onClick={addReminder} className="text-sm font-medium underline">
            + Add reminder
          </button>
        </div>
      </div>
    </div>
  );
}
