"use client";

import { MEETING_TYPES, type MeetingDraft, type TripWizardDraft, newId } from "@/lib/host/wizard/types";

export function MeetingsStep({
  draft,
  onChange,
}: {
  draft: TripWizardDraft;
  onChange: (draft: TripWizardDraft) => void;
}) {
  function addMeeting() {
    const mtg: MeetingDraft = {
      id: newId(),
      title: "",
      description: null,
      date: "",
      time: null,
      location: null,
      meetingType: "student_meeting",
      notes: null,
      audienceType: "everyone",
      audienceId: null,
    };
    onChange({ ...draft, meetings: [...draft.meetings, mtg] });
  }

  function updateMeeting(i: number, patch: Partial<MeetingDraft>) {
    onChange({
      ...draft,
      meetings: draft.meetings.map((m, j) => (j === i ? { ...m, ...patch } : m)),
    });
  }

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">Pre-trip meetings</h2>
      <p className="text-sm text-zinc-600">
        Meetings before the trip starts appear on the Today screen and countdown.
      </p>
      <div className="space-y-4">
        {draft.meetings.map((mtg, i) => (
          <div key={mtg.id} className="rounded-xl border border-zinc-200 p-4 space-y-2">
            <div className="flex justify-between">
              <span className="text-sm font-medium">Meeting</span>
              <button
                type="button"
                className="text-xs text-red-600"
                onClick={() =>
                  onChange({
                    ...draft,
                    meetings: draft.meetings.filter((_, j) => j !== i),
                  })
                }
              >
                Remove
              </button>
            </div>
            <input
              value={mtg.title}
              onChange={(e) => updateMeeting(i, { title: e.target.value })}
              placeholder="Title"
              className="h-10 w-full rounded-lg border border-zinc-200 px-2 text-sm"
            />
            <div className="grid gap-2 sm:grid-cols-2">
              <input
                type="date"
                value={mtg.date}
                onChange={(e) => updateMeeting(i, { date: e.target.value })}
                className="h-10 rounded-lg border border-zinc-200 px-2 text-sm"
              />
              <input
                type="time"
                value={mtg.time ?? ""}
                onChange={(e) => updateMeeting(i, { time: e.target.value || null })}
                className="h-10 rounded-lg border border-zinc-200 px-2 text-sm"
              />
            </div>
            <input
              value={mtg.location ?? ""}
              onChange={(e) => updateMeeting(i, { location: e.target.value || null })}
              placeholder="Location"
              className="h-10 w-full rounded-lg border border-zinc-200 px-2 text-sm"
            />
            <select
              value={mtg.meetingType}
              onChange={(e) =>
                updateMeeting(i, {
                  meetingType: e.target.value as MeetingDraft["meetingType"],
                })
              }
              className="h-10 w-full rounded-lg border border-zinc-200 px-2 text-sm"
            >
              {MEETING_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t.replace(/_/g, " ")}
                </option>
              ))}
            </select>
            <textarea
              value={mtg.description ?? ""}
              onChange={(e) => updateMeeting(i, { description: e.target.value || null })}
              placeholder="Description"
              rows={2}
              className="w-full rounded-lg border border-zinc-200 px-2 py-1 text-sm"
            />
          </div>
        ))}
        <button type="button" onClick={addMeeting} className="text-sm font-medium underline">
          + Add meeting
        </button>
      </div>
    </div>
  );
}
