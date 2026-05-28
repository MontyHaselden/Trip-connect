"use client";

import { useState } from "react";

import { hostJson } from "@/components/host/shared/host-fetch";

import type { RosterRoom } from "./types";

export function RoomForm(props: {
  inviteCode: string;
  room?: RosterRoom;
  onSaved: () => void;
  onCancel?: () => void;
  onError: (msg: string) => void;
}) {
  const { inviteCode, room, onSaved, onCancel, onError } = props;
  const api = `/api/host/${encodeURIComponent(inviteCode)}`;

  const [roomName, setRoomName] = useState(room?.roomName ?? "");
  const [hotelName, setHotelName] = useState(room?.hotelName ?? "");
  const [hotelAddress, setHotelAddress] = useState(room?.hotelAddress ?? "");
  const [nearestStation, setNearestStation] = useState(room?.nearestStation ?? "");
  const [notes, setNotes] = useState(room?.notes ?? "");
  const [saving, setSaving] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const payload = {
      roomName: roomName.trim(),
      hotelName: hotelName.trim() || null,
      hotelAddress: hotelAddress.trim() || null,
      nearestStation: nearestStation.trim() || null,
      notes: notes.trim() || null,
    };
    try {
      if (room) {
        await hostJson(`${api}/rooms/${room.id}`, {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(payload),
        });
      } else {
        await hostJson(`${api}/rooms`, {
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
    <form onSubmit={submit} className="space-y-3 rounded-xl border border-dashed border-zinc-300 bg-zinc-50 p-4">
      <p className="text-sm font-medium">{room ? "Edit room" : "Add room"}</p>
      <input
        required
        placeholder="Room name (e.g. 301)"
        value={roomName}
        onChange={(e) => setRoomName(e.target.value)}
        className="h-10 w-full rounded-lg border border-zinc-200 px-3 text-sm"
      />
      <input
        placeholder="Hotel name"
        value={hotelName}
        onChange={(e) => setHotelName(e.target.value)}
        className="h-10 w-full rounded-lg border border-zinc-200 px-3 text-sm"
      />
      <input
        placeholder="Hotel address"
        value={hotelAddress}
        onChange={(e) => setHotelAddress(e.target.value)}
        className="h-10 w-full rounded-lg border border-zinc-200 px-3 text-sm"
      />
      <input
        placeholder="Nearest station"
        value={nearestStation}
        onChange={(e) => setNearestStation(e.target.value)}
        className="h-10 w-full rounded-lg border border-zinc-200 px-3 text-sm"
      />
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={saving}
          className="inline-flex h-10 items-center justify-center rounded-xl bg-zinc-900 px-4 text-sm font-medium text-white disabled:opacity-50"
        >
          {saving ? "Saving…" : room ? "Update" : "Add room"}
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
