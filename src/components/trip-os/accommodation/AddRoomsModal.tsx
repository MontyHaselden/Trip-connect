"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { hostJson } from "@/components/host/shared/host-fetch";
import type { AccommodationStayDraft } from "@/lib/host/wizard/types";
import { newId } from "@/lib/host/wizard/types";
import type { RosterSummary } from "@/lib/trip-engine/types";

import { TripInput } from "../shared/TripInput";
import { TripPrimaryButton } from "../shared/TripPrimaryButton";

type RoomRow = {
  key: string;
  roomName: string;
  participantIds: string[];
};

type AccommodationPayload = {
  hotels: Array<{
    key: string;
    name: string;
    rooms: Array<{
      id: string;
      roomName: string;
      participants: Array<{ id: string; fullName: string }>;
    }>;
  }>;
  unassignedParticipants: Array<{ id: string; fullName: string }>;
};

function emptyRow(): RoomRow {
  return { key: newId(), roomName: "", participantIds: [] };
}

function normalizeHotelKey(name: string): string {
  return name.trim().toLowerCase();
}

export function AddRoomsModal(props: {
  open: boolean;
  onClose: () => void;
  tripId: string;
  inviteCode: string;
  hotelStays: AccommodationStayDraft[];
  roster: RosterSummary;
  initialStayId?: string | null;
  onSaved?: () => void;
}) {
  const api = `/api/host/${encodeURIComponent(props.inviteCode)}`;
  const [stayId, setStayId] = useState(props.hotelStays[0]?.id ?? "");
  const [rows, setRows] = useState<RoomRow[]>([emptyRow()]);
  const [data, setData] = useState<AccommodationPayload | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedStay = props.hotelStays.find((s) => s.id === stayId) ?? props.hotelStays[0];

  const load = useCallback(async () => {
    const body = await hostJson<AccommodationPayload>(`/api/trips/${props.tripId}/accommodation`);
    setData(body);
  }, [props.tripId]);

  useEffect(() => {
    if (!props.open) return;
    setRows([emptyRow()]);
    setError(null);
    const preferred =
      props.initialStayId && props.hotelStays.some((s) => s.id === props.initialStayId)
        ? props.initialStayId
        : props.hotelStays[0]?.id ?? "";
    setStayId(preferred);
    load().catch(() => setData(null));
  }, [props.open, props.initialStayId, props.hotelStays, load]);

  const hotelGroup = useMemo(() => {
    if (!data || !selectedStay?.name?.trim()) return null;
    const key = normalizeHotelKey(selectedStay.name);
    return (
      data.hotels.find((h) => normalizeHotelKey(h.name) === key) ??
      data.hotels.find((h) => normalizeHotelKey(h.name).startsWith(key)) ??
      null
    );
  }, [data, selectedStay]);

  const students = useMemo(
    () => props.roster.participants.filter((p) => p.role === "student"),
    [props.roster.participants],
  );

  const assignedRoomByParticipant = useMemo(() => {
    const map = new Map<string, string>();
    for (const hotel of data?.hotels ?? []) {
      for (const room of hotel.rooms) {
        for (const p of room.participants) {
          map.set(p.id, room.roomName);
        }
      }
    }
    return map;
  }, [data]);

  const draftRoomByParticipant = useMemo(() => {
    const map = new Map<string, { rowKey: string; label: string }>();
    for (const row of rows) {
      const label = row.roomName.trim() || "another room";
      for (const participantId of row.participantIds) {
        map.set(participantId, { rowKey: row.key, label });
      }
    }
    return map;
  }, [rows]);

  function updateRow(key: string, patch: Partial<RoomRow>) {
    setRows((prev) => prev.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  }

  function toggleParticipant(rowKey: string, participantId: string) {
    setRows((prev) =>
      prev.map((row) => {
        if (row.key !== rowKey) {
          return {
            ...row,
            participantIds: row.participantIds.filter((id) => id !== participantId),
          };
        }
        const has = row.participantIds.includes(participantId);
        return {
          ...row,
          participantIds: has
            ? row.participantIds.filter((id) => id !== participantId)
            : [...row.participantIds, participantId],
        };
      }),
    );
  }

  function addRow() {
    setRows((prev) => [...prev, emptyRow()]);
  }

  function removeRow(key: string) {
    setRows((prev) => (prev.length <= 1 ? prev : prev.filter((r) => r.key !== key)));
  }

  async function saveAll() {
    if (!selectedStay?.name?.trim()) {
      setError("Choose a hotel stay first.");
      return;
    }
    const valid = rows.filter((r) => r.roomName.trim());
    if (!valid.length) {
      setError("Add at least one room number or name.");
      return;
    }

    setBusy(true);
    setError(null);
    try {
      for (const row of valid) {
        const created = await hostJson<{ id: string }>(`${api}/rooms`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            roomName: row.roomName.trim(),
            hotelName: selectedStay.name.trim(),
            hotelAddress: selectedStay.address ?? null,
          }),
        });
        for (const participantId of row.participantIds) {
          await hostJson(`${api}/participants/${participantId}`, {
            method: "PATCH",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ roomId: created.id }),
          });
        }
      }
      props.onSaved?.();
      props.onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save rooms");
    } finally {
      setBusy(false);
    }
  }

  if (!props.open) return null;

  const dateLabel =
    selectedStay?.checkInDate && selectedStay?.checkOutDate
      ? `${selectedStay.checkInDate} → ${selectedStay.checkOutDate}`
      : "";

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end justify-center bg-zinc-950/45 p-4 backdrop-blur-[2px] sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="rooms-modal-title"
    >
      <div className="flex max-h-[min(90vh,52rem)] w-full max-w-2xl flex-col overflow-hidden rounded-3xl bg-white shadow-2xl ring-1 ring-zinc-200/80">
        <div className="shrink-0 border-b border-zinc-100 bg-gradient-to-b from-zinc-50 to-white px-6 py-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-violet-600">
                Hotels
              </p>
              <h2 id="rooms-modal-title" className="mt-1 text-xl font-semibold tracking-tight text-zinc-900">
                Add rooms
              </h2>
              {selectedStay ? (
                <p className="mt-1 text-sm text-zinc-600">
                  {selectedStay.name} · {selectedStay.cityLabel}
                  {dateLabel ? ` · ${dateLabel}` : ""}
                </p>
              ) : null}
            </div>
            <button
              type="button"
              onClick={props.onClose}
              disabled={busy}
              className="rounded-full p-2 text-zinc-400 transition hover:bg-zinc-100 hover:text-zinc-700"
              aria-label="Close"
            >
              <span className="text-lg leading-none">×</span>
            </button>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
          {!props.hotelStays.length ? (
            <p className="rounded-2xl border border-dashed border-zinc-300 bg-zinc-50 px-4 py-6 text-center text-sm text-zinc-600">
              Add a hotel stay on the calendar first, then assign rooms here.
            </p>
          ) : (
            <div className="space-y-4">
              {props.hotelStays.length > 1 ? (
                <label className="block space-y-1.5">
                  <span className="text-xs font-medium text-zinc-500">Hotel</span>
                  <select
                    value={stayId}
                    onChange={(e) => setStayId(e.target.value)}
                    className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-800"
                  >
                    {props.hotelStays.map((stay) => (
                      <option key={stay.id} value={stay.id}>
                        {stay.name} ({stay.cityLabel})
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}

              {hotelGroup?.rooms.length ? (
                <div className="rounded-2xl border border-zinc-200 bg-zinc-50/80 px-4 py-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                    Existing rooms
                  </p>
                  <ul className="mt-2 space-y-1.5 text-sm text-zinc-700">
                    {hotelGroup.rooms.map((room) => (
                      <li key={room.id}>
                        <span className="font-medium">Room {room.roomName}</span>
                        {room.participants.length ? (
                          <span className="text-zinc-500">
                            {" "}
                            · {room.participants.map((p) => p.fullName).join(", ")}
                          </span>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              {rows.map((row, index) => (
                <div
                  key={row.key}
                  className="rounded-2xl border border-zinc-200/90 bg-white p-4 shadow-sm"
                >
                  <div className="mb-3 flex items-center justify-between gap-2">
                    <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                      Room {index + 1}
                    </p>
                    {rows.length > 1 ? (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => removeRow(row.key)}
                        className="text-xs font-medium text-zinc-500 hover:text-red-600"
                      >
                        Remove
                      </button>
                    ) : null}
                  </div>
                  <TripInput
                    value={row.roomName}
                    onChange={(e) => updateRow(row.key, { roomName: e.target.value })}
                    placeholder="Room number (e.g. 301)"
                  />
                  {students.length ? (
                    <div className="mt-3">
                      <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
                        Students
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {students.map((student) => {
                          const selected = row.participantIds.includes(student.id);
                          const savedRoom = assignedRoomByParticipant.get(student.id);
                          const draftRoom = draftRoomByParticipant.get(student.id);
                          const takenInSaved = Boolean(savedRoom) && !selected;
                          const takenInOtherDraft =
                            Boolean(draftRoom && draftRoom.rowKey !== row.key) && !selected;
                          return (
                            <button
                              key={student.id}
                              type="button"
                              disabled={busy || takenInSaved}
                              onClick={() => toggleParticipant(row.key, student.id)}
                              title={
                                takenInSaved
                                  ? `Already in room ${savedRoom}`
                                  : takenInOtherDraft
                                    ? `In ${draftRoom!.label} — click to move here`
                                    : undefined
                              }
                              className={[
                                "rounded-full px-3 py-1.5 text-xs font-medium transition",
                                selected
                                  ? "bg-zinc-900 text-white shadow-sm"
                                  : takenInSaved
                                    ? "cursor-not-allowed bg-zinc-100 text-zinc-400"
                                    : takenInOtherDraft
                                      ? "bg-zinc-100/70 text-zinc-400 opacity-45 saturate-50 hover:opacity-70"
                                      : "bg-zinc-50 text-zinc-700 ring-1 ring-zinc-200 hover:ring-zinc-300",
                              ].join(" ")}
                            >
                              {student.fullName}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ) : (
                    <p className="mt-2 text-xs text-zinc-500">
                      Add students in Users before assigning rooms.
                    </p>
                  )}
                </div>
              ))}

              <button
                type="button"
                disabled={busy}
                onClick={addRow}
                className="w-full rounded-2xl border border-dashed border-zinc-300 py-3 text-sm font-medium text-zinc-600 transition hover:border-violet-300 hover:bg-violet-50/50 hover:text-violet-800"
              >
                + Add another room
              </button>
            </div>
          )}
        </div>

        <div className="shrink-0 border-t border-zinc-100 bg-zinc-50/80 px-6 py-4">
          {error ? <p className="mb-3 text-sm text-red-600">{error}</p> : null}
          <div className="flex flex-wrap justify-end gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={props.onClose}
              className="rounded-full px-5 py-2.5 text-sm font-medium text-zinc-600 hover:bg-zinc-200/60"
            >
              Cancel
            </button>
            <TripPrimaryButton
              onClick={() => void saveAll()}
              disabled={busy || !props.hotelStays.length}
              className="rounded-full px-6"
            >
              {busy ? "Saving…" : "Save rooms"}
            </TripPrimaryButton>
          </div>
        </div>
      </div>
    </div>
  );
}
