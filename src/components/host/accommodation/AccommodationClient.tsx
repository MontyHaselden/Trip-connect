"use client";

import { useCallback, useEffect, useState } from "react";

import { hostJson } from "@/components/host/shared/host-fetch";

type AccommodationPayload = {
  hotels: Array<{
    key: string;
    name: string;
    address: string | null;
    dates: string[];
    cities: string[];
    rooms: Array<{
      id: string;
      roomName: string;
      participantIds: string[];
      participants: Array<{ id: string; fullName: string; role: string }>;
    }>;
  }>;
  unassignedParticipants: Array<{ id: string; fullName: string; role: string }>;
  allRooms: Array<{ id: string; roomName: string; hotelName: string | null }>;
  allParticipants: Array<{ id: string; fullName: string; roomId: string | null }>;
};

export function AccommodationClient(props: {
  tripId: string;
  inviteCode: string;
  compact?: boolean;
}) {
  const { tripId, inviteCode, compact } = props;
  const api = `/api/host/${encodeURIComponent(inviteCode)}`;
  const [data, setData] = useState<AccommodationPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newRoomName, setNewRoomName] = useState("");
  const [newRoomHotel, setNewRoomHotel] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch(`/api/trips/${tripId}/accommodation`);
    const body = await res.json();
    if (!res.ok) throw new Error(body.error || "Failed to load");
    setData(body);
  }, [tripId]);

  useEffect(() => {
    load()
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load"))
      .finally(() => setLoading(false));
  }, [load]);

  async function assignParticipant(participantId: string, roomId: string | null) {
    setBusy(true);
    try {
      await hostJson(`${api}/participants/${participantId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ roomId }),
      });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Update failed");
    } finally {
      setBusy(false);
    }
  }

  async function addRoom(hotelName: string) {
    if (!newRoomName.trim()) return;
    setBusy(true);
    try {
      await hostJson(`${api}/rooms`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          roomName: newRoomName.trim(),
          hotelName: hotelName || newRoomHotel.trim() || null,
        }),
      });
      setNewRoomName("");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not add room");
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return <p className="text-sm text-zinc-600">Loading accommodation…</p>;
  }

  if (!data) {
    return (
      <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-800">
        {error ?? "Failed to load"}
      </p>
    );
  }

  return (
    <div className="space-y-5">
      {!compact ? (
        <header>
          <h1 className="text-2xl font-semibold tracking-tight">Accommodation</h1>
          <p className="mt-1 text-sm text-zinc-600">
            Hotels from your itinerary, with room assignments for each stay.
          </p>
        </header>
      ) : null}

      {error ? (
        <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-800">{error}</p>
      ) : null}

      {data.hotels.length === 0 ? (
        <p className="rounded-xl border border-dashed border-zinc-300 p-6 text-sm text-zinc-600">
          No hotel stays found yet. Add hotel activities to your itinerary, or create
          rooms manually below.
        </p>
      ) : (
        data.hotels.map((hotel) => (
          <section
            key={hotel.key}
            className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm"
          >
            <h2 className="text-lg font-semibold">{hotel.name}</h2>
            {hotel.address ? (
              <p className="mt-0.5 text-sm text-zinc-600">{hotel.address}</p>
            ) : null}
            <p className="mt-1 text-xs text-zinc-500">
              {hotel.dates.join(", ") || "Dates TBD"}
              {hotel.cities.length ? ` · ${hotel.cities.join(" / ")}` : ""}
            </p>

            <ul className="mt-4 space-y-3">
              {hotel.rooms.length ? (
                hotel.rooms.map((room) => (
                  <li
                    key={room.id}
                    className="rounded-lg border border-zinc-100 bg-zinc-50/80 p-3"
                  >
                    <p className="text-sm font-semibold">Room {room.roomName}</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {room.participants.map((p) => (
                        <span
                          key={p.id}
                          className="rounded-full bg-white px-2.5 py-1 text-xs font-medium text-zinc-800 shadow-sm"
                        >
                          {p.fullName}
                        </span>
                      ))}
                      {!room.participants.length ? (
                        <span className="text-xs text-zinc-500">No one assigned</span>
                      ) : null}
                    </div>
                    <select
                      disabled={busy}
                      className="mt-2 w-full rounded-lg border border-zinc-200 px-2 py-1.5 text-xs"
                      defaultValue=""
                      onChange={(e) => {
                        const pid = e.target.value;
                        if (!pid) return;
                        void assignParticipant(pid, room.id);
                        e.target.value = "";
                      }}
                    >
                      <option value="">Add person to this room…</option>
                      {data.unassignedParticipants.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.fullName}
                        </option>
                      ))}
                    </select>
                  </li>
                ))
              ) : (
                <li className="text-sm text-zinc-500">No rooms yet for this hotel.</li>
              )}
            </ul>

            <div className="mt-3 flex gap-2">
              <input
                value={newRoomName}
                onChange={(e) => {
                  setNewRoomHotel(hotel.name);
                  setNewRoomName(e.target.value);
                }}
                placeholder="Room number (e.g. 301)"
                className="h-9 min-w-0 flex-1 rounded-lg border border-zinc-200 px-2 text-sm"
              />
              <button
                type="button"
                disabled={busy}
                onClick={() => addRoom(hotel.name)}
                className="h-9 shrink-0 rounded-lg bg-zinc-900 px-3 text-xs font-medium text-white disabled:opacity-50"
              >
                Add room
              </button>
            </div>
          </section>
        ))
      )}

      {data.unassignedParticipants.length > 0 ? (
        <section className="rounded-xl border border-amber-200 bg-amber-50/50 p-4">
          <h3 className="text-sm font-semibold text-amber-950">Not in a room yet</h3>
          <ul className="mt-2 space-y-1">
            {data.unassignedParticipants.map((p) => (
              <li key={p.id} className="text-sm text-amber-900">
                {p.fullName}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
