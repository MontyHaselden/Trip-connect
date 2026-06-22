"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { newId } from "@/lib/host/wizard/types";
import type { TripCommand } from "@/lib/trip-engine/commands";
import type { RosterSummaryParticipant } from "@/lib/trip-engine/types";

import { TripInput } from "../shared/TripInput";
import { TripPrimaryButton } from "../shared/TripPrimaryButton";

type FamilyRow = {
  key: string;
  name: string;
  address: string;
  studentIds: string[];
};

type Assignment = {
  id: string;
  stayId: string;
  participantId: string | null;
};

function emptyRow(): FamilyRow {
  return { key: newId(), name: "", address: "", studentIds: [] };
}

export function AddHomestaysModal(props: {
  open: boolean;
  onClose: () => void;
  tripId: string;
  groupId: string;
  cityLabel: string;
  checkIn: string;
  checkOut: string;
  students: RosterSummaryParticipant[];
  onDispatch: (commands: TripCommand[]) => Promise<boolean>;
  onSaved?: () => void;
}) {
  const [rows, setRows] = useState<FamilyRow[]>([emptyRow()]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadAssignments = useCallback(async () => {
    const res = await fetch(`/api/trips/${props.tripId}/accommodation-assignments`);
    const body = await res.json();
    if (!res.ok) throw new Error(body.error || "Failed to load assignments");
    setAssignments(body.assignments ?? []);
  }, [props.tripId]);

  useEffect(() => {
    if (!props.open) return;
    setRows([emptyRow()]);
    setError(null);
    loadAssignments().catch(() => setAssignments([]));
  }, [props.open, loadAssignments]);

  const assignedElsewhere = useMemo(
    () =>
      new Set(
        assignments.filter((a) => a.participantId).map((a) => a.participantId!),
      ),
    [assignments],
  );

  function updateRow(key: string, patch: Partial<FamilyRow>) {
    setRows((prev) => prev.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  }

  function toggleStudent(rowKey: string, studentId: string) {
    setRows((prev) =>
      prev.map((row) => {
        if (row.key !== rowKey) {
          return {
            ...row,
            studentIds: row.studentIds.filter((id) => id !== studentId),
          };
        }
        const has = row.studentIds.includes(studentId);
        return {
          ...row,
          studentIds: has
            ? row.studentIds.filter((id) => id !== studentId)
            : [...row.studentIds, studentId],
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
    const valid = rows.filter((r) => r.name.trim() && r.studentIds.length > 0);
    if (!valid.length) {
      setError("Add at least one host family with a name and at least one student.");
      return;
    }
    if (!props.checkIn || !props.checkOut) {
      setError("Check-in and check-out dates are required.");
      return;
    }

    setBusy(true);
    setError(null);
    try {
      const city = props.cityLabel.trim() || "Homestay";
      const commands: TripCommand[] = valid.map((row) => ({
        type: "addStay",
        groupId: props.groupId,
        stay: {
          id: row.key,
          cityLabel: city,
          stayType: "homestay",
          name: row.name.trim(),
          url: null,
          address: row.address.trim() || null,
          phone: null,
          checkInDate: props.checkIn,
          checkOutDate: props.checkOut,
          notes: null,
          isHomestayGroup: false,
          multipleInCity: true,
        },
      }));

      const ok = await props.onDispatch(commands);
      if (!ok) throw new Error("Could not save homestays");

      for (const row of valid) {
        for (const participantId of row.studentIds) {
          const res = await fetch(`/api/trips/${props.tripId}/accommodation-assignments`, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
              stayId: row.key,
              participantId,
              startDate: props.checkIn,
              endDate: props.checkOut,
            }),
          });
          const body = await res.json();
          if (!res.ok) throw new Error(body.error || "Could not assign student");
        }
      }

      props.onSaved?.();
      props.onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save homestays");
    } finally {
      setBusy(false);
    }
  }

  if (!props.open) return null;

  const dateLabel =
    props.checkIn === props.checkOut
      ? props.checkIn
      : `${props.checkIn} → ${props.checkOut}`;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end justify-center bg-zinc-950/45 p-4 backdrop-blur-[2px] sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="homestays-modal-title"
    >
      <div className="flex max-h-[min(90vh,52rem)] w-full max-w-2xl flex-col overflow-hidden rounded-3xl bg-white shadow-2xl ring-1 ring-zinc-200/80">
        <div className="shrink-0 border-b border-zinc-100 bg-gradient-to-b from-zinc-50 to-white px-6 py-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-violet-600">
                Host families
              </p>
              <h2 id="homestays-modal-title" className="mt-1 text-xl font-semibold tracking-tight text-zinc-900">
                Add homestays
              </h2>
              <p className="mt-1 text-sm text-zinc-600">
                {props.cityLabel.trim() || "Homestay"} · {dateLabel}
              </p>
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
          <p className="mb-4 text-sm leading-relaxed text-zinc-600">
            Add each host family below. Students see their assigned family on the emergency card for
            these nights.
          </p>

          {!props.students.length ? (
            <p className="rounded-2xl border border-dashed border-zinc-300 bg-zinc-50 px-4 py-6 text-center text-sm text-zinc-600">
              Add students in Participants before assigning homestays.
            </p>
          ) : (
            <div className="space-y-4">
              {rows.map((row, index) => (
                <div
                  key={row.key}
                  className="rounded-2xl border border-zinc-200/90 bg-white p-4 shadow-sm"
                >
                  <div className="mb-3 flex items-center justify-between gap-2">
                    <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                      Family {index + 1}
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
                  <div className="grid gap-3 sm:grid-cols-2">
                    <TripInput
                      value={row.name}
                      onChange={(e) => updateRow(row.key, { name: e.target.value })}
                      placeholder="Host family name"
                      className="sm:col-span-2"
                    />
                    <TripInput
                      value={row.address}
                      onChange={(e) => updateRow(row.key, { address: e.target.value })}
                      placeholder="Address (optional)"
                      className="sm:col-span-2"
                    />
                  </div>
                  <div className="mt-3">
                    <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
                      Students
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {props.students.map((student) => {
                        const selected = row.studentIds.includes(student.id);
                        const taken = assignedElsewhere.has(student.id) && !selected;
                        const disabled = busy || taken;
                        return (
                          <button
                            key={student.id}
                            type="button"
                            disabled={disabled}
                            onClick={() => toggleStudent(row.key, student.id)}
                            title={
                              taken ? "Already assigned to another homestay" : undefined
                            }
                            className={[
                              "rounded-full px-3 py-1.5 text-xs font-medium transition",
                              selected
                                ? "bg-zinc-900 text-white shadow-sm"
                                : disabled
                                  ? "bg-zinc-100 text-zinc-400"
                                  : "bg-zinc-50 text-zinc-700 ring-1 ring-zinc-200 hover:ring-zinc-300",
                            ].join(" ")}
                          >
                            {student.fullName}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              ))}

              <button
                type="button"
                disabled={busy}
                onClick={addRow}
                className="w-full rounded-2xl border border-dashed border-zinc-300 py-3 text-sm font-medium text-zinc-600 transition hover:border-violet-300 hover:bg-violet-50/50 hover:text-violet-800"
              >
                + Add another family
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
              disabled={busy || !props.students.length}
              className="rounded-full px-6"
            >
              {busy ? "Saving…" : "Save host families"}
            </TripPrimaryButton>
          </div>
        </div>
      </div>
    </div>
  );
}
