"use client";

import { useMemo, useState } from "react";

import type { ActivityDraft } from "@/lib/host/wizard/types";
import { activitiesForGroup } from "@/lib/trip-engine/selectors";
import type { TripEntityGraph } from "@/lib/trip-engine/types";
import type { TripCommand } from "@/lib/trip-engine/commands";

import { AsyncButton } from "../shared/AsyncButton";
import { TripSectionShell, TripSoftPanel } from "../shared/TripSectionShell";

function activitySortKey(a: ActivityDraft): string {
  return `${a.date}\0${a.isTimeTbc || !a.startTime?.trim() ? "99:99" : a.startTime.slice(0, 5)}`;
}

function formatActivityLine(a: ActivityDraft): string {
  const parts = [a.date];
  if (!a.isTimeTbc && a.startTime?.trim()) {
    const start = a.startTime.slice(0, 5);
    const end = a.endTime?.trim()?.slice(0, 5);
    parts.push(end ? `${start}–${end}` : start);
  }
  if (a.locationName?.trim()) parts.push(a.locationName.trim());
  return parts.join(" · ");
}

export function ActivitiesSection(props: {
  graph: TripEntityGraph;
  groupId: string;
  saving?: boolean;
  onDispatch: (commands: TripCommand[]) => Promise<boolean>;
}) {
  const [removingId, setRemovingId] = useState<string | null>(null);

  const activities = useMemo(() => {
    return [...activitiesForGroup(props.graph, props.groupId)].sort((a, b) =>
      activitySortKey(a).localeCompare(activitySortKey(b)),
    );
  }, [props.graph, props.groupId]);

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
    <TripSectionShell
      title="Activities"
      description="Activities as shown on the trip calendar. Add or change them by selecting days on the calendar."
    >
      <TripSoftPanel>
        {activities.length ? (
          <ul className="space-y-2">
            {activities.map((a) => (
              <li
                key={a.id}
                className="flex items-center justify-between gap-3 rounded-2xl bg-white px-4 py-3 shadow-sm"
              >
                <div className="min-w-0">
                  <p className="font-medium text-zinc-900">{a.title}</p>
                  <p className="text-sm text-zinc-500">{formatActivityLine(a)}</p>
                </div>
                <AsyncButton
                  loading={removingId === a.id}
                  loadingLabel="…"
                  onClick={() => void removeActivity(a.id)}
                  className="shrink-0 text-sm text-red-600 hover:text-red-700"
                >
                  Delete
                </AsyncButton>
              </li>
            ))}
          </ul>
        ) : (
          <p className="py-8 text-center text-sm leading-relaxed text-zinc-500">
            No activities on the calendar yet. Select days on the trip calendar and use{" "}
            <span className="font-medium text-zinc-700">Activities → Add</span> there.
          </p>
        )}
      </TripSoftPanel>
    </TripSectionShell>
  );
}
