"use client";

import { useState } from "react";

import type { TripEntityGraph } from "@/lib/trip-engine/types";
import type { TripCommand } from "@/lib/trip-engine/commands";
import { newId } from "@/lib/host/wizard/types";

import { AsyncButton } from "../shared/AsyncButton";
import { TripDateInput } from "../shared/TripDateInput";
import { tripDatePickerContext } from "../shared/trip-date-picker";

export function ActivitiesSection(props: {
  graph: TripEntityGraph;
  groupId: string;
  selectedDate: string | null;
  saving?: boolean;
  onDispatch: (commands: TripCommand[]) => Promise<boolean>;
}) {
  const datePicker = tripDatePickerContext(props.graph, props.selectedDate);
  const [title, setTitle] = useState("");
  const [date, setDate] = useState(props.selectedDate ?? "");
  const [start, setStart] = useState("10:00");
  const [end, setEnd] = useState("12:00");
  const [location, setLocation] = useState("");

  async function addActivity() {
    if (!title.trim() || !date) return;
    await props.onDispatch([
      {
        type: "addActivity",
        groupId: props.groupId,
        activity: {
          id: newId(),
          title: title.trim(),
          date,
          endDate: null,
          startTime: start,
          endTime: end,
          isTimeTbc: false,
          category: "activity",
          locationName: location.trim() || null,
          address: null,
          isLocationTbc: !location.trim(),
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
    setTitle("");
    setLocation("");
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Activities</h2>
        <p className="text-sm text-zinc-600">Advanced / bulk edit — things you do on the trip skeleton.</p>
      </div>
      <ul className="space-y-2">
        {props.graph.activities.map((a) => (
          <li key={a.id} className="flex items-center justify-between rounded-lg border border-zinc-200 p-3">
            <div>
              <p className="font-medium">{a.title}</p>
              <p className="text-sm text-zinc-600">
                {a.date}
                {a.startTime ? ` · ${a.startTime}` : ""}
                {a.locationName ? ` · ${a.locationName}` : ""}
              </p>
            </div>
            <AsyncButton
              loading={props.saving}
              loadingLabel="Removing…"
              onClick={() =>
                void props.onDispatch([
                  { type: "removeActivity", groupId: props.groupId, activityId: a.id },
                ])
              }
              className="text-sm text-red-700 hover:underline"
            >
              Delete
            </AsyncButton>
          </li>
        ))}
        {!props.graph.activities.length ? (
          <li className="rounded-lg border border-dashed border-zinc-300 p-4 text-sm text-zinc-500">
            No activities yet.
          </li>
        ) : null}
      </ul>
      <div className="rounded-xl border border-zinc-200 p-4">
        <h3 className="text-sm font-semibold">Add activity</h3>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title" className="rounded-lg border px-3 py-2 text-sm sm:col-span-2" />
          <TripDateInput
            value={date}
            onChange={setDate}
            tripStart={datePicker.tripStart}
            tripEnd={datePicker.tripEnd}
            anchorDate={datePicker.anchorDate}
            className="rounded-lg border px-3 py-2 text-sm"
          />
          <input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Location" className="rounded-lg border px-3 py-2 text-sm" />
          <input value={start} onChange={(e) => setStart(e.target.value)} placeholder="Start HH:MM" className="rounded-lg border px-3 py-2 text-sm" />
          <input value={end} onChange={(e) => setEnd(e.target.value)} placeholder="End HH:MM" className="rounded-lg border px-3 py-2 text-sm" />
        </div>
        <AsyncButton
          onClick={() => void addActivity()}
          loading={props.saving}
          loadingLabel="Adding…"
          className="mt-3 rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white"
        >
          Add activity
        </AsyncButton>
      </div>
    </div>
  );
}
