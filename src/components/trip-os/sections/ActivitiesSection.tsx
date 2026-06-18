"use client";

import { useState } from "react";

import type { TripEntityGraph } from "@/lib/trip-engine/types";
import type { TripCommand } from "@/lib/trip-engine/commands";
import { newId } from "@/lib/host/wizard/types";

import { AsyncButton } from "../shared/AsyncButton";
import { TripDateInput } from "../shared/TripDateInput";
import { TripInput, tripFieldClass } from "../shared/TripInput";
import { TripPrimaryButton } from "../shared/TripPrimaryButton";
import { TripSectionShell, TripSoftPanel } from "../shared/TripSectionShell";
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
    <TripSectionShell
      eyebrow="Advanced"
      title="Activities"
      description="Things you do on the trip skeleton."
    >
      <ul className="space-y-2">
        {props.graph.activities.map((a) => (
          <li
            key={a.id}
            className="flex items-center justify-between rounded-2xl bg-white px-4 py-3 shadow-sm"
          >
            <div>
              <p className="font-medium text-zinc-900">{a.title}</p>
              <p className="text-sm text-zinc-500">
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
              className="text-sm text-red-600 hover:text-red-700"
            >
              Delete
            </AsyncButton>
          </li>
        ))}
        {!props.graph.activities.length ? (
          <li className="rounded-2xl bg-zinc-50/80 px-4 py-6 text-center text-sm text-zinc-500">
            No activities yet.
          </li>
        ) : null}
      </ul>
      <TripSoftPanel title="Add activity">
        <div className="grid gap-2 sm:grid-cols-2">
          <TripInput value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title" className="sm:col-span-2" />
          <TripDateInput
            value={date}
            onChange={setDate}
            tripStart={datePicker.tripStart}
            tripEnd={datePicker.tripEnd}
            anchorDate={datePicker.anchorDate}
            className={tripFieldClass}
          />
          <TripInput value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Location" />
          <TripInput value={start} onChange={(e) => setStart(e.target.value)} placeholder="Start HH:MM" />
          <TripInput value={end} onChange={(e) => setEnd(e.target.value)} placeholder="End HH:MM" />
        </div>
        <TripPrimaryButton onClick={() => void addActivity()} disabled={props.saving} className="mt-4">
          {props.saving ? "Adding…" : "Add activity"}
        </TripPrimaryButton>
      </TripSoftPanel>
    </TripSectionShell>
  );
}
