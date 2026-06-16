"use client";

import { useCallback, useEffect, useState } from "react";

import type { AccommodationStayDraft } from "@/lib/host/wizard/types";

type Assignment = {
  id: string;
  stayId: string;
  stayName: string | null;
  stayCityLabel: string;
  participantId: string | null;
  participantName: string | null;
  groupId: string | null;
  groupName: string | null;
  roomId: string | null;
  roomName: string | null;
  startDate: string;
  endDate: string;
};

export function AccommodationAssignmentsPanel(props: {
  tripId: string;
  stays: AccommodationStayDraft[];
  groups: Array<{ id: string; name: string }>;
  participants: Array<{ id: string; fullName: string }>;
}) {
  const { tripId, stays, groups, participants } = props;
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [stayId, setStayId] = useState(stays[0]?.id ?? "");
  const [targetKind, setTargetKind] = useState<"participant" | "group">("group");
  const [targetId, setTargetId] = useState("");
  const [startDate, setStartDate] = useState(stays[0]?.checkInDate ?? "");
  const [endDate, setEndDate] = useState(stays[0]?.checkOutDate ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch(`/api/trips/${tripId}/accommodation-assignments`);
    const body = await res.json();
    if (!res.ok) throw new Error(body.error || "Failed to load assignments");
    setAssignments(body.assignments ?? []);
  }, [tripId]);

  useEffect(() => {
    load().catch(() => setAssignments([]));
  }, [load]);

  useEffect(() => {
    const stay = stays.find((s) => s.id === stayId);
    if (stay) {
      setStartDate(stay.checkInDate);
      setEndDate(stay.checkOutDate);
    }
  }, [stayId, stays]);

  async function addAssignment() {
    if (!stayId || !targetId) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/trips/${tripId}/accommodation-assignments`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          stayId,
          participantId: targetKind === "participant" ? targetId : null,
          groupId: targetKind === "group" ? targetId : null,
          startDate,
          endDate,
        }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || "Could not add assignment");
      setTargetId("");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not add assignment");
    } finally {
      setBusy(false);
    }
  }

  async function removeAssignment(id: string) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/trips/${tripId}/accommodation-assignments?id=${encodeURIComponent(id)}`,
        { method: "DELETE" },
      );
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || "Could not remove assignment");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not remove assignment");
    } finally {
      setBusy(false);
    }
  }

  if (!stays.length) return null;

  const targetOptions = targetKind === "group" ? groups : participants;

  return (
    <section className="space-y-3 rounded-xl border border-zinc-200 p-4">
      <div>
        <h3 className="text-sm font-semibold">Stay assignments</h3>
        <p className="mt-1 text-xs text-zinc-600">
          Assign groups or students to a hotel/homestay for specific nights. Everyone-visible
          stays with no assignment act as trip defaults.
        </p>
      </div>

      {assignments.length ? (
        <ul className="space-y-2 text-sm">
          {assignments.map((a) => (
            <li
              key={a.id}
              className="flex items-start justify-between gap-2 rounded-lg border border-zinc-200 px-3 py-2"
            >
              <div>
                <p className="font-medium">
                  {a.stayName || a.stayCityLabel} · {a.startDate} → {a.endDate}
                </p>
                <p className="text-xs text-zinc-600">
                  {a.groupName ?? a.participantName ?? a.roomName ?? "Unassigned target"}
                </p>
              </div>
              <button
                type="button"
                disabled={busy}
                onClick={() => removeAssignment(a.id)}
                className="text-xs font-medium text-red-700 disabled:opacity-50"
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-xs text-zinc-500">No assignments yet.</p>
      )}

      <div className="grid gap-2 sm:grid-cols-2">
        <label className="block text-xs">
          <span className="font-medium text-zinc-700">Stay</span>
          <select
            value={stayId}
            onChange={(e) => setStayId(e.target.value)}
            className="mt-1 h-9 w-full rounded-lg border border-zinc-200 px-2 text-sm"
          >
            {stays.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name || s.cityLabel} ({s.checkInDate} – {s.checkOutDate})
              </option>
            ))}
          </select>
        </label>
        <label className="block text-xs">
          <span className="font-medium text-zinc-700">Assign to</span>
          <div className="mt-1 flex gap-2">
            <select
              value={targetKind}
              onChange={(e) => {
                setTargetKind(e.target.value as "participant" | "group");
                setTargetId("");
              }}
              className="h-9 rounded-lg border border-zinc-200 px-2 text-sm"
            >
              <option value="group">Group</option>
              <option value="participant">Student</option>
            </select>
            <select
              value={targetId}
              onChange={(e) => setTargetId(e.target.value)}
              className="h-9 min-w-0 flex-1 rounded-lg border border-zinc-200 px-2 text-sm"
            >
              <option value="">Select…</option>
              {targetOptions.map((t) => (
                <option key={t.id} value={t.id}>
                  {"fullName" in t ? t.fullName : t.name}
                </option>
              ))}
            </select>
          </div>
        </label>
        <label className="block text-xs">
          <span className="font-medium text-zinc-700">From</span>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="mt-1 h-9 w-full rounded-lg border border-zinc-200 px-2 text-sm"
          />
        </label>
        <label className="block text-xs">
          <span className="font-medium text-zinc-700">Until</span>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="mt-1 h-9 w-full rounded-lg border border-zinc-200 px-2 text-sm"
          />
        </label>
      </div>

      <button
        type="button"
        disabled={busy || !stayId || !targetId}
        onClick={addAssignment}
        className="rounded-lg bg-zinc-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
      >
        Add assignment
      </button>
      {error ? <p className="text-xs text-red-600">{error}</p> : null}
    </section>
  );
}
