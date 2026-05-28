"use client";

import { useState } from "react";

import { hostJson } from "@/components/host/shared/host-fetch";

import type { RosterGroup, RosterParticipant, RosterRoom } from "./types";

export function ParticipantForm(props: {
  inviteCode: string;
  participant?: RosterParticipant;
  rooms: RosterRoom[];
  groups: RosterGroup[];
  onSaved: () => void;
  onCancel?: () => void;
  onError: (msg: string) => void;
}) {
  const { inviteCode, participant, rooms, groups, onSaved, onCancel, onError } =
    props;
  const api = `/api/host/${encodeURIComponent(inviteCode)}`;
  const editing = Boolean(participant);

  const [fullName, setFullName] = useState(participant?.fullName ?? "");
  const [phoneNumber, setPhoneNumber] = useState(
    participant?.phoneNumberE164 ?? "",
  );
  const [role, setRole] = useState<RosterParticipant["role"]>(
    participant?.role ?? "student",
  );
  const [roomId, setRoomId] = useState(participant?.roomId ?? "");
  const [groupIds, setGroupIds] = useState<string[]>(
    participant?.groupIds ?? [],
  );
  const [saving, setSaving] = useState(false);

  function toggleGroup(id: string) {
    setGroupIds((ids) =>
      ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id],
    );
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const payload = {
      fullName: fullName.trim(),
      phoneNumber: phoneNumber.trim(),
      role,
      roomId: roomId || null,
      groupIds,
    };
    try {
      if (editing && participant) {
        await hostJson(`${api}/participants/${participant.id}`, {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(payload),
        });
      } else {
        await hostJson(`${api}/participants`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(payload),
        });
      }
      onSaved();
    } catch (err) {
      onError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form
      onSubmit={submit}
      className="space-y-3 rounded-xl border border-dashed border-zinc-300 bg-zinc-50 p-4"
    >
      <p className="text-sm font-medium">
        {editing ? "Edit participant" : "Add participant"}
      </p>
      <input
        required
        placeholder="Full name"
        value={fullName}
        onChange={(e) => setFullName(e.target.value)}
        className="h-10 w-full rounded-lg border border-zinc-200 px-3 text-sm"
      />
      <input
        required
        placeholder="Phone number"
        value={phoneNumber}
        onChange={(e) => setPhoneNumber(e.target.value)}
        className="h-10 w-full rounded-lg border border-zinc-200 px-3 text-sm"
      />
      <select
        value={role}
        onChange={(e) => setRole(e.target.value as RosterParticipant["role"])}
        className="h-10 w-full rounded-lg border border-zinc-200 px-3 text-sm"
      >
        <option value="student">Student</option>
        <option value="helper">Helper</option>
        <option value="teacher">Teacher</option>
        <option value="host">Host</option>
      </select>
      <label className="block text-sm">
        <span className="text-xs font-medium text-zinc-600">Room</span>
        <select
          value={roomId}
          onChange={(e) => setRoomId(e.target.value)}
          className="mt-1 h-10 w-full rounded-lg border border-zinc-200 px-3 text-sm"
        >
          <option value="">No room</option>
          {rooms.map((r) => (
            <option key={r.id} value={r.id}>
              {r.roomName}
            </option>
          ))}
        </select>
      </label>
      <fieldset>
        <legend className="text-xs font-medium text-zinc-600">Groups</legend>
        <div className="mt-2 flex flex-wrap gap-2">
          {groups.length === 0 ? (
            <p className="text-xs text-zinc-500">Add groups below first.</p>
          ) : (
            groups.map((g) => (
              <label
                key={g.id}
                className="inline-flex items-center gap-1 rounded-lg border border-zinc-200 bg-white px-2 py-1 text-xs"
              >
                <input
                  type="checkbox"
                  checked={groupIds.includes(g.id)}
                  onChange={() => toggleGroup(g.id)}
                />
                {g.name}
              </label>
            ))
          )}
        </div>
      </fieldset>
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={saving}
          className="inline-flex h-10 items-center justify-center rounded-xl bg-zinc-900 px-4 text-sm font-medium text-white disabled:opacity-50"
        >
          {saving ? "Saving…" : editing ? "Update" : "Add"}
        </button>
        {onCancel ? (
          <button
            type="button"
            onClick={onCancel}
            className="inline-flex h-10 items-center justify-center rounded-xl border border-zinc-200 px-4 text-sm"
          >
            Cancel
          </button>
        ) : null}
      </div>
    </form>
  );
}
