"use client";

import type { VisibilityMode, VisibilityTarget } from "@/lib/visibility/types";

export type VisibilityPickerValue = {
  visibilityMode: VisibilityMode;
  targets: VisibilityTarget[];
};

export function VisibilityPicker(props: {
  value: VisibilityPickerValue;
  onChange: (value: VisibilityPickerValue) => void;
  groups: Array<{ id: string; name: string }>;
  participants: Array<{ id: string; fullName: string }>;
  rooms?: Array<{ id: string; roomName: string }>;
  compact?: boolean;
}) {
  const { value, onChange, groups, participants, rooms = [], compact } = props;

  const showTargets = value.visibilityMode === "custom";

  function toggleTarget(target: VisibilityTarget) {
    const exists = value.targets.some(
      (t) => t.targetType === target.targetType && t.targetId === target.targetId,
    );
    const targets = exists
      ? value.targets.filter(
          (t) => !(t.targetType === target.targetType && t.targetId === target.targetId),
        )
      : [...value.targets, target];
    onChange({ ...value, targets });
  }

  return (
    <div className={compact ? "space-y-2" : "space-y-3 rounded-lg border border-zinc-200 bg-zinc-50 p-3"}>
      {!compact ? (
        <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Who can see this</p>
      ) : null}
      <select
        value={value.visibilityMode}
        onChange={(e) =>
          onChange({
            visibilityMode: e.target.value as VisibilityMode,
            targets: e.target.value === "custom" ? value.targets : [],
          })
        }
        className="h-9 w-full rounded-lg border border-zinc-200 bg-white px-2 text-sm"
      >
        <option value="everyone">Everyone</option>
        <option value="staff_only">Staff only</option>
        <option value="viewers_only">Viewers only</option>
        <option value="hidden_from_students">Hidden from students</option>
        <option value="custom">Specific groups or people</option>
      </select>

      {showTargets ? (
        <div className="max-h-40 space-y-2 overflow-y-auto text-sm">
          {groups.length ? (
            <div>
              <p className="mb-1 text-[11px] font-medium text-zinc-500">Groups / routes</p>
              <div className="flex flex-wrap gap-1">
                {groups.map((g) => {
                  const selected = value.targets.some(
                    (t) => t.targetType === "group" && t.targetId === g.id,
                  );
                  return (
                    <button
                      key={g.id}
                      type="button"
                      onClick={() => toggleTarget({ targetType: "group", targetId: g.id })}
                      className={[
                        "rounded-full px-2 py-0.5 text-xs font-medium",
                        selected
                          ? "bg-zinc-900 text-white"
                          : "bg-white text-zinc-700 ring-1 ring-zinc-200",
                      ].join(" ")}
                    >
                      {g.name}
                    </button>
                  );
                })}
              </div>
            </div>
          ) : null}
          {participants.length ? (
            <div>
              <p className="mb-1 text-[11px] font-medium text-zinc-500">Individuals</p>
              <div className="flex flex-wrap gap-1">
                {participants.map((p) => {
                  const selected = value.targets.some(
                    (t) => t.targetType === "participant" && t.targetId === p.id,
                  );
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() =>
                        toggleTarget({ targetType: "participant", targetId: p.id })
                      }
                      className={[
                        "rounded-full px-2 py-0.5 text-xs font-medium",
                        selected
                          ? "bg-zinc-900 text-white"
                          : "bg-white text-zinc-700 ring-1 ring-zinc-200",
                      ].join(" ")}
                    >
                      {p.fullName}
                    </button>
                  );
                })}
              </div>
            </div>
          ) : null}
          {rooms.length ? (
            <div>
              <p className="mb-1 text-[11px] font-medium text-zinc-500">Rooms</p>
              <div className="flex flex-wrap gap-1">
                {rooms.map((r) => {
                  const selected = value.targets.some(
                    (t) => t.targetType === "room" && t.targetId === r.id,
                  );
                  return (
                    <button
                      key={r.id}
                      type="button"
                      onClick={() => toggleTarget({ targetType: "room", targetId: r.id })}
                      className={[
                        "rounded-full px-2 py-0.5 text-xs font-medium",
                        selected
                          ? "bg-zinc-900 text-white"
                          : "bg-white text-zinc-700 ring-1 ring-zinc-200",
                      ].join(" ")}
                    >
                      {r.roomName}
                    </button>
                  );
                })}
              </div>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
