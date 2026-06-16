"use client";

import { useMemo, useState } from "react";

import { groupsStatusItems } from "@/lib/host/setup/section-status-items";
import type { TripSetupState } from "@/lib/host/setup/types";

import { SetupAddsPanel } from "./SetupAddsPanel";
import { SetupSectionSplit } from "./SetupSectionSplit";
import { SetupSectionStatusPanel } from "./SetupSectionStatusPanel";

const GROUP_TYPE_OPTIONS = [
  { value: "split_travel", label: "Split travel group" },
  { value: "activity", label: "Activity group" },
  { value: "accommodation", label: "Accommodation group" },
  { value: "staff_helper", label: "Staff/helper group" },
  { value: "other", label: "Other" },
] as const;

function formatGroupType(type: string): string {
  return type.replace(/_/g, " ");
}

export function SetupGroupsSection(props: {
  state: TripSetupState;
  sectionLabel?: string;
  sectionMessage?: string;
  onCreateGroup: (name: string, type: string) => Promise<void>;
  onDeleteGroup: (groupId: string) => Promise<void>;
}) {
  const { state, sectionLabel, sectionMessage, onCreateGroup, onDeleteGroup } = props;
  const [name, setName] = useState("");
  const [type, setType] = useState<string>("split_travel");
  const [busy, setBusy] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const extraGroups = state.groups.filter((g) => !g.isMain);

  const statusItems = useMemo(() => groupsStatusItems(state), [state]);

  async function submitGroup() {
    if (!name.trim()) return;
    setBusy(true);
    try {
      await onCreateGroup(name.trim(), type);
      setName("");
    } finally {
      setBusy(false);
    }
  }

  async function removeGroup(groupId: string, groupName: string) {
    if (
      !window.confirm(
        `Delete "${groupName}"? This removes the group's calendar overlays and any transport or stays created only for that group.`,
      )
    ) {
      return;
    }
    setDeletingId(groupId);
    try {
      await onDeleteGroup(groupId);
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <SetupSectionSplit
      status={
        <SetupSectionStatusPanel
          section={
            sectionLabel
              ? { id: "groups", label: sectionLabel, status: "todo", message: sectionMessage }
              : undefined
          }
          items={statusItems}
        />
      }
      adds={
        <SetupAddsPanel>
          <div className="space-y-4">
            <p className="text-sm text-zinc-600">
              Complete the Main Group first, then add groups that inherit the base plan and overlay
              their own changes on the calendar.
            </p>

            {extraGroups.length ? (
              <div className="space-y-2 rounded-lg border border-zinc-200 bg-white p-4">
                <h3 className="text-sm font-medium text-zinc-900">Your groups</h3>
                <ul className="space-y-2">
                  {extraGroups.map((group) => (
                    <li
                      key={group.id}
                      className="flex items-center justify-between gap-3 rounded-lg border border-zinc-100 bg-zinc-50 px-3 py-2"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-zinc-900">{group.name}</p>
                        <p className="text-xs capitalize text-zinc-500">
                          {formatGroupType(group.type)}
                        </p>
                      </div>
                      <button
                        type="button"
                        disabled={deletingId === group.id}
                        onClick={() => void removeGroup(group.id, group.name)}
                        className="shrink-0 text-xs font-medium text-red-700 disabled:opacity-50"
                      >
                        {deletingId === group.id ? "Deleting…" : "Delete"}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            <div className="space-y-3 rounded-lg border border-zinc-200 bg-white p-4">
              <h3 className="text-sm font-medium text-zinc-900">Add group</h3>
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
                {GROUP_TYPE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
              <button
                type="button"
                disabled={busy || !name.trim()}
                onClick={() => void submitGroup()}
                className="h-10 w-full rounded-lg bg-zinc-900 text-sm font-medium text-white disabled:opacity-50"
              >
                {busy ? "Creating…" : "Add group"}
              </button>
            </div>
          </div>
        </SetupAddsPanel>
      }
    />
  );
}
