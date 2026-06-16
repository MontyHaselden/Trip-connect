"use client";

import { useState } from "react";

export type PropagateScope = "main_only" | "all_groups" | "selected_groups";

export function PropagateChangeModal(props: {
  open: boolean;
  groupNames: string[];
  onClose: () => void;
  onConfirm: (scope: PropagateScope, selectedGroupIds?: string[]) => void;
}) {
  const { open, groupNames, onClose, onConfirm } = props;
  const [scope, setScope] = useState<PropagateScope>("main_only");

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
        <h3 className="text-lg font-semibold">Apply changes</h3>
        <p className="mt-2 text-sm text-zinc-600">
          This item is shared with other groups. How should this change be applied?
        </p>
        <div className="mt-4 space-y-2">
          {(
            [
              ["main_only", "Main Group only"],
              ["all_groups", "Apply to all groups"],
              ["selected_groups", "Apply to selected groups"],
            ] as const
          ).map(([value, label]) => (
            <label key={value} className="flex cursor-pointer items-center gap-2 text-sm">
              <input
                type="radio"
                name="scope"
                checked={scope === value}
                onChange={() => setScope(value)}
              />
              {label}
            </label>
          ))}
        </div>
        {scope === "selected_groups" && groupNames.length ? (
          <p className="mt-3 text-xs text-zinc-500">
            Selected groups: {groupNames.join(", ")}
          </p>
        ) : null}
        <div className="mt-6 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-4 py-2 text-sm text-zinc-600"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => onConfirm(scope)}
            className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white"
          >
            Apply
          </button>
        </div>
      </div>
    </div>
  );
}
