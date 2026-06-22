"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import {
  defaultHomestayFamilyDates,
  homestayFamilyStays,
  homestayPeriodStays,
} from "@/lib/host/accommodation/homestay-helpers";
import type { AccommodationStayDraft } from "@/lib/host/wizard/types";
import { newId } from "@/lib/host/wizard/types";
import type { TripCommand } from "@/lib/trip-engine/commands";
import type { RosterSummary, TripEntityGraph } from "@/lib/trip-engine/types";

import { TripDateInput } from "../shared/TripDateInput";
import { TripInput, tripFieldClass } from "../shared/TripInput";
import { TripPrimaryButton } from "../shared/TripPrimaryButton";
import { TripSoftPanel } from "../shared/TripSectionShell";
import { tripDatePickerContext } from "../shared/trip-date-picker";

type Assignment = {
  id: string;
  stayId: string;
  participantId: string | null;
  participantName: string | null;
  startDate: string;
  endDate: string;
};

export function HomestaysPanel(props: {
  tripId: string;
  groupId: string;
  graph: TripEntityGraph;
  stays: AccommodationStayDraft[];
  roster: RosterSummary;
  selectedDate?: string | null;
  saving?: boolean;
  onDispatch: (commands: TripCommand[]) => Promise<boolean>;
}) {
  const { tripId, groupId, graph, stays, roster, onDispatch } = props;
  const periods = homestayPeriodStays(stays);
  const families = homestayFamilyStays(stays);
  const students = useMemo(
    () => roster.participants.filter((p) => p.role === "student"),
    [roster.participants],
  );

  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [familyName, setFamilyName] = useState("");
  const [address, setAddress] = useState("");
  const defaultDates = defaultHomestayFamilyDates(periods);
  const [checkIn, setCheckIn] = useState(defaultDates?.checkInDate ?? "");
  const [checkOut, setCheckOut] = useState(defaultDates?.checkOutDate ?? "");
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([]);

  const datePicker = tripDatePickerContext(graph, props.selectedDate);

  const loadAssignments = useCallback(async () => {
    const res = await fetch(`/api/trips/${tripId}/accommodation-assignments`);
    const body = await res.json();
    if (!res.ok) throw new Error(body.error || "Failed to load assignments");
    setAssignments(body.assignments ?? []);
  }, [tripId]);

  useEffect(() => {
    loadAssignments().catch(() => setAssignments([]));
  }, [loadAssignments, stays.length]);

  useEffect(() => {
    const dates = defaultHomestayFamilyDates(periods);
    if (dates) {
      setCheckIn(dates.checkInDate);
      setCheckOut(dates.checkOutDate);
    }
  }, [periods.map((p) => p.id).join(",")]);

  const assignmentsByStay = useMemo(() => {
    const map = new Map<string, Assignment[]>();
    for (const a of assignments) {
      if (!a.participantId) continue;
      const list = map.get(a.stayId) ?? [];
      list.push(a);
      map.set(a.stayId, list);
    }
    return map;
  }, [assignments]);

  function toggleStudent(id: string) {
    setSelectedStudentIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }

  async function addFamilyHomestay() {
    if (!familyName.trim() || !checkIn || !checkOut || !selectedStudentIds.length) return;
    setBusy(true);
    setError(null);
    try {
      const stayId = newId();
      const cityLabel = periods[0]?.cityLabel ?? "Homestay";
      const ok = await onDispatch([
        {
          type: "addStay",
          groupId,
          stay: {
            id: stayId,
            cityLabel,
            stayType: "homestay",
            name: familyName.trim(),
            url: null,
            address: address.trim() || null,
            phone: null,
            checkInDate: checkIn,
            checkOutDate: checkOut,
            notes: null,
            isHomestayGroup: false,
            multipleInCity: true,
          },
        },
      ]);
      if (!ok) throw new Error("Could not save homestay");

      for (const participantId of selectedStudentIds) {
        const res = await fetch(`/api/trips/${tripId}/accommodation-assignments`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            stayId,
            participantId,
            startDate: checkIn,
            endDate: checkOut,
          }),
        });
        const body = await res.json();
        if (!res.ok) throw new Error(body.error || "Could not assign student");
      }

      setFamilyName("");
      setAddress("");
      setSelectedStudentIds([]);
      await loadAssignments();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not add homestay");
    } finally {
      setBusy(false);
    }
  }

  async function removeFamily(stayId: string) {
    if (!window.confirm("Remove this homestay and its student assignments?")) return;
    setBusy(true);
    setError(null);
    try {
      const ok = await onDispatch([{ type: "removeStay", groupId, stayId }]);
      if (!ok) throw new Error("Could not remove homestay");
      await loadAssignments();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not remove homestay");
    } finally {
      setBusy(false);
    }
  }

  async function removeAssignment(assignmentId: string) {
    setBusy(true);
    try {
      const res = await fetch(
        `/api/trips/${tripId}/accommodation-assignments?id=${encodeURIComponent(assignmentId)}`,
        { method: "DELETE" },
      );
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || "Could not remove student");
      await loadAssignments();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not remove student");
    } finally {
      setBusy(false);
    }
  }

  if (!periods.length) return null;

  const assignedElsewhere = new Set(
    assignments.filter((a) => a.participantId).map((a) => a.participantId!),
  );

  return (
    <TripSoftPanel title="Host families">
      <p className="mb-4 text-sm text-zinc-600">
        Add each host family by name and address, then choose which students stay there. Students
        see their assigned family on the emergency card for those nights.
      </p>

      {families.length ? (
        <ul className="mb-4 space-y-2">
          {families.map((family) => {
            const linked = assignmentsByStay.get(family.id) ?? [];
            return (
              <li
                key={family.id}
                className="rounded-2xl border border-zinc-200 bg-white px-4 py-3 shadow-sm"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-medium text-zinc-900">{family.name}</p>
                    {family.address ? (
                      <p className="mt-0.5 text-sm text-zinc-600">{family.address}</p>
                    ) : null}
                    <p className="mt-1 text-xs text-zinc-500">
                      {family.checkInDate} → {family.checkOutDate}
                    </p>
                  </div>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void removeFamily(family.id)}
                    className="text-sm text-red-600 hover:text-red-700 disabled:opacity-50"
                  >
                    Delete
                  </button>
                </div>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {linked.map((a) => (
                    <span
                      key={a.id}
                      className="inline-flex items-center gap-1 rounded-full bg-zinc-100 px-2.5 py-1 text-xs font-medium text-zinc-800"
                    >
                      {a.participantName}
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void removeAssignment(a.id)}
                        className="text-zinc-500 hover:text-red-600"
                        aria-label={`Remove ${a.participantName}`}
                      >
                        ×
                      </button>
                    </span>
                  ))}
                  {!linked.length ? (
                    <span className="text-xs text-zinc-500">No students assigned</span>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="mb-4 text-sm text-zinc-500">No host families added yet.</p>
      )}

      <div className="space-y-3 rounded-2xl border border-dashed border-zinc-300 bg-zinc-50/80 p-4">
        <p className="text-sm font-medium text-zinc-900">Add host family</p>
        <div className="grid gap-2 sm:grid-cols-2">
          <TripInput
            value={familyName}
            onChange={(e) => setFamilyName(e.target.value)}
            placeholder="Host family name"
          />
          <TripInput
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="Address (optional)"
            className="sm:col-span-2"
          />
          <TripDateInput
            value={checkIn}
            onChange={setCheckIn}
            tripStart={datePicker.tripStart}
            tripEnd={datePicker.tripEnd}
            anchorDate={datePicker.anchorDate}
            className={tripFieldClass}
          />
          <TripDateInput
            value={checkOut}
            onChange={setCheckOut}
            tripStart={datePicker.tripStart}
            tripEnd={datePicker.tripEnd}
            anchorDate={datePicker.anchorDate}
            className={tripFieldClass}
          />
        </div>

        {students.length ? (
          <div>
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-zinc-500">
              Students in this homestay
            </p>
            <div className="flex flex-wrap gap-1.5">
              {students.map((s) => {
                const selected = selectedStudentIds.includes(s.id);
                const taken = assignedElsewhere.has(s.id) && !selected;
                return (
                  <button
                    key={s.id}
                    type="button"
                    disabled={busy || taken}
                    onClick={() => toggleStudent(s.id)}
                    title={taken ? "Already assigned to another homestay" : undefined}
                    className={[
                      "rounded-full px-2.5 py-1 text-xs font-medium transition",
                      selected
                        ? "bg-zinc-900 text-white"
                        : taken
                          ? "bg-zinc-100 text-zinc-400"
                          : "bg-white text-zinc-700 ring-1 ring-zinc-200 hover:ring-zinc-300",
                    ].join(" ")}
                  >
                    {s.fullName}
                  </button>
                );
              })}
            </div>
          </div>
        ) : (
          <p className="text-xs text-zinc-500">Add students in Participants before assigning homestays.</p>
        )}

        <TripPrimaryButton
          onClick={() => void addFamilyHomestay()}
          disabled={
            busy ||
            props.saving ||
            !familyName.trim() ||
            !checkIn ||
            !checkOut ||
            !selectedStudentIds.length
          }
        >
          {busy ? "Saving…" : "Add homestay"}
        </TripPrimaryButton>
      </div>

      {error ? <p className="mt-2 text-sm text-red-600">{error}</p> : null}
    </TripSoftPanel>
  );
}
