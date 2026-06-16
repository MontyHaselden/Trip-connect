"use client";

import { useState } from "react";

import type { SetupGroup } from "@/lib/host/setup/types";

const GROUP_TYPE_OPTIONS = [
  { value: "split_travel", label: "Split travel group" },
  { value: "activity", label: "Activity group" },
  { value: "accommodation", label: "Accommodation group" },
  { value: "staff_helper", label: "Staff/helper group" },
  { value: "other", label: "Other" },
] as const;

function GroupModal(props: {
  open: boolean;
  onClose: () => void;
  onCreateGroup: (name: string, type: string) => Promise<void>;
}) {
  const { open, onClose, onCreateGroup } = props;
  const [step, setStep] = useState<"confirm" | "form">("confirm");
  const [name, setName] = useState("");
  const [type, setType] = useState<string>("split_travel");
  const [busy, setBusy] = useState(false);

  if (!open) return null;

  async function submitGroup() {
    if (!name.trim()) return;
    setBusy(true);
    try {
      await onCreateGroup(name.trim(), type);
      onClose();
      setStep("confirm");
      setName("");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
        {step === "confirm" ? (
          <>
            <h3 className="text-lg font-semibold">Add a group</h3>
            <p className="mt-3 text-sm text-zinc-600">
              Best practice is to complete the Main Group first, then add group-specific changes on
              top. This group will inherit the Main Group itinerary.
            </p>
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
                onClick={() => setStep("form")}
                className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white"
              >
                Continue
              </button>
            </div>
          </>
        ) : (
          <>
            <h3 className="text-lg font-semibold">New group</h3>
            <div className="mt-4 space-y-3">
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Group name"
                className="h-10 w-full rounded-lg border border-zinc-200 px-3 text-sm"
              />
              <select
                value={type}
                onChange={(e) => setType(e.target.value)}
                className="h-10 w-full rounded-lg border border-zinc-200 px-3 text-sm"
              >
                {GROUP_TYPE_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setStep("confirm")}
                className="rounded-lg px-4 py-2 text-sm text-zinc-600"
              >
                Back
              </button>
              <button
                type="button"
                disabled={busy || !name.trim()}
                onClick={() => void submitGroup()}
                className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
              >
                {busy ? "Creating…" : "Create group"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export function SetupGroupSelector(props: {
  groups: SetupGroup[];
  activeGroupId: string;
  onSelect: (groupId: string) => void;
  onCreateGroup: (name: string, type: string) => Promise<void>;
  variant?: "toolbar" | "bar";
}) {
  const { groups, activeGroupId, onSelect, onCreateGroup, variant = "bar" } = props;
  const [modalOpen, setModalOpen] = useState(false);

  const pills = (
    <>
      {groups.map((g) => (
        <button
          key={g.id}
          type="button"
          onClick={() => onSelect(g.id)}
          className={[
            "rounded-full px-2.5 py-1 text-xs font-medium transition",
            activeGroupId === g.id
              ? "bg-zinc-900 text-white"
              : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200",
          ].join(" ")}
        >
          {g.isMain ? "Main Group" : g.name}
        </button>
      ))}
      <button
        type="button"
        onClick={() => setModalOpen(true)}
        className="rounded-full border border-dashed border-zinc-300 px-2.5 py-1 text-xs text-zinc-600 hover:border-zinc-400"
      >
        + Add group
      </button>
    </>
  );

  return (
    <>
      {variant === "toolbar" ? (
        <div className="flex flex-wrap items-center gap-1.5">{pills}</div>
      ) : (
        <div className="flex flex-wrap items-center gap-2 border-b border-zinc-200 bg-white px-4 py-3">
          <span className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Group</span>
          {pills}
        </div>
      )}

      <GroupModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onCreateGroup={onCreateGroup}
      />
    </>
  );
}
