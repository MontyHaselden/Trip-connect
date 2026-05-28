"use client";

import type { SnapshotDiff } from "@/lib/publish/compare-snapshots";

const SECTION_LABELS: Record<keyof SnapshotDiff, string> = {
  trip: "Trip settings",
  days: "Trip days",
  itineraryItems: "Itinerary items",
  tomorrowPrepItems: "Tomorrow prep",
  contacts: "Contacts",
  participants: "Participants",
  rooms: "Rooms",
  groups: "Groups",
  participantAssignments: "Room & group assignments",
  phraseCategories: "Phrase categories",
  phrases: "Phrases",
};

function SectionBlock(props: {
  title: string;
  added: { label: string }[];
  removed: { label: string }[];
  changed: { label: string }[];
}) {
  const { title, added, removed, changed } = props;
  if (!added.length && !removed.length && !changed.length) return null;

  return (
    <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4">
      <h3 className="text-sm font-semibold text-zinc-900">{title}</h3>
      <div className="mt-2 space-y-2 text-sm text-zinc-700">
        {added.length ? (
          <div>
            <span className="font-medium text-emerald-800">Added ({added.length})</span>
            <ul className="mt-1 list-inside list-disc text-xs">
              {added.slice(0, 8).map((e, i) => (
                <li key={i}>{e.label}</li>
              ))}
              {added.length > 8 ? (
                <li className="text-zinc-500">+{added.length - 8} more</li>
              ) : null}
            </ul>
          </div>
        ) : null}
        {changed.length ? (
          <div>
            <span className="font-medium text-amber-900">
              Changed ({changed.length})
            </span>
            <ul className="mt-1 list-inside list-disc text-xs">
              {changed.slice(0, 8).map((e, i) => (
                <li key={i}>{e.label}</li>
              ))}
              {changed.length > 8 ? (
                <li className="text-zinc-500">+{changed.length - 8} more</li>
              ) : null}
            </ul>
          </div>
        ) : null}
        {removed.length ? (
          <div>
            <span className="font-medium text-red-800">
              Removed ({removed.length})
            </span>
            <ul className="mt-1 list-inside list-disc text-xs">
              {removed.slice(0, 8).map((e, i) => (
                <li key={i}>{e.label}</li>
              ))}
              {removed.length > 8 ? (
                <li className="text-zinc-500">+{removed.length - 8} more</li>
              ) : null}
            </ul>
          </div>
        ) : null}
      </div>
    </div>
  );
}

export function PublishDiff(props: { diff: SnapshotDiff }) {
  const { diff } = props;

  return (
    <div className="flex flex-col gap-3">
      {(Object.keys(SECTION_LABELS) as Array<keyof SnapshotDiff>).map((key) => (
        <SectionBlock
          key={key}
          title={SECTION_LABELS[key]}
          added={diff[key].added}
          removed={diff[key].removed}
          changed={diff[key].changed}
        />
      ))}
    </div>
  );
}
