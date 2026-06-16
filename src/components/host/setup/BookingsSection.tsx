"use client";

import { useEffect, useMemo, useState } from "react";

import { bookingsStatusItems } from "@/lib/host/setup/section-status-items";
import type { TripSetupState } from "@/lib/host/setup/types";

import { SetupAddsPanel } from "./SetupAddsPanel";
import { SetupSectionSplit } from "./SetupSectionSplit";
import { SetupSectionStatusPanel } from "./SetupSectionStatusPanel";

type BookingRow = {
  entityType: "transport_leg" | "accommodation_stay";
  entityId: string;
  label: string;
  bookingStatus: string;
};

export function BookingsSection(props: {
  tripId: string;
  state: TripSetupState;
  sectionLabel?: string;
  sectionMessage?: string;
}) {
  const { tripId, state, sectionLabel, sectionMessage } = props;
  const [selected, setSelected] = useState<BookingRow | null>(null);
  const [form, setForm] = useState({
    bookingStatus: "not_booked",
    supplier: "",
    bookingReference: "",
    invoiceNumber: "",
    internalNotes: "",
  });
  const [busy, setBusy] = useState(false);

  const rows: BookingRow[] = useMemo(
    () =>
      [
        ...state.outboundLegs.map((l) => ({
          entityType: "transport_leg" as const,
          entityId: l.id,
          label: `Outbound: ${l.fromCity} → ${l.toCity}`,
          bookingStatus: l.bookingStatus,
        })),
        ...state.returnLegs.map((l) => ({
          entityType: "transport_leg" as const,
          entityId: l.id,
          label: `Return: ${l.fromCity} → ${l.toCity}`,
          bookingStatus: l.bookingStatus,
        })),
        ...state.intercityLegs.map((l) => ({
          entityType: "transport_leg" as const,
          entityId: l.id,
          label: `Intercity: ${l.intercityFromCity} → ${l.intercityToCity}`,
          bookingStatus: l.bookingStatus,
        })),
        ...state.accommodationStays.map((s) => ({
          entityType: "accommodation_stay" as const,
          entityId: s.id,
          label: `${s.cityLabel}: ${s.name ?? "TBC"}`,
          bookingStatus: s.stayType === "not_booked" ? "not_booked" : "booked",
        })),
      ].filter(
        (row, index, self) => self.findIndex((r) => r.entityId === row.entityId) === index,
      ),
    [state],
  );

  const statusItems = useMemo(() => bookingsStatusItems(state), [state]);

  useEffect(() => {
    if (!selected) return;
    void fetch(
      `/api/trips/${tripId}/booking-details/${selected.entityType}/${selected.entityId}`,
    )
      .then((r) => r.json())
      .then((body) => {
        const b = body.booking;
        if (b) {
          setForm({
            bookingStatus: b.bookingStatus ?? "not_booked",
            supplier: b.supplier ?? "",
            bookingReference: b.bookingReference ?? "",
            invoiceNumber: b.invoiceNumber ?? "",
            internalNotes: b.internalNotes ?? "",
          });
        }
      })
      .catch(() => undefined);
  }, [selected, tripId]);

  async function save() {
    if (!selected) return;
    setBusy(true);
    try {
      await fetch(
        `/api/trips/${tripId}/booking-details/${selected.entityType}/${selected.entityId}`,
        {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(form),
        },
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <SetupSectionSplit
      status={
        <SetupSectionStatusPanel
          section={
            sectionLabel
              ? { id: "bookings", label: sectionLabel, status: "todo", message: sectionMessage }
              : undefined
          }
          items={statusItems}
        />
      }
      adds={
        <SetupAddsPanel>
          <div className="space-y-4">
            <p className="text-sm text-zinc-600">
              Admin-only booking references. Hidden from students and viewers.
            </p>

            {rows.length ? (
              <ul className="divide-y divide-zinc-100 rounded-xl border border-zinc-200 bg-white">
                {rows.map((r) => (
                  <li key={r.entityId}>
                    <button
                      type="button"
                      onClick={() => setSelected(r)}
                      className={[
                        "flex w-full items-center justify-between px-4 py-3 text-left text-sm",
                        selected?.entityId === r.entityId ? "bg-zinc-50" : "hover:bg-zinc-50",
                      ].join(" ")}
                    >
                      <span>{r.label}</span>
                      <span className="text-xs text-zinc-500">{r.bookingStatus}</span>
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-zinc-500">Add transport and accommodation first.</p>
            )}

            {selected ? (
              <div className="space-y-3 rounded-xl border border-zinc-200 bg-white p-4">
                <h3 className="font-medium">{selected.label}</h3>
                <select
                  value={form.bookingStatus}
                  onChange={(e) => setForm((f) => ({ ...f, bookingStatus: e.target.value }))}
                  className="h-10 w-full rounded-lg border border-zinc-200 px-3 text-sm"
                >
                  <option value="booked">Booked</option>
                  <option value="flexible">Flexible</option>
                  <option value="placeholder">Placeholder</option>
                  <option value="not_booked">Not booked</option>
                  <option value="cancelled">Cancelled</option>
                </select>
                <input
                  placeholder="Supplier"
                  value={form.supplier}
                  onChange={(e) => setForm((f) => ({ ...f, supplier: e.target.value }))}
                  className="h-10 w-full rounded-lg border border-zinc-200 px-3 text-sm"
                />
                <input
                  placeholder="Booking reference"
                  value={form.bookingReference}
                  onChange={(e) => setForm((f) => ({ ...f, bookingReference: e.target.value }))}
                  className="h-10 w-full rounded-lg border border-zinc-200 px-3 text-sm"
                />
                <input
                  placeholder="Invoice number"
                  value={form.invoiceNumber}
                  onChange={(e) => setForm((f) => ({ ...f, invoiceNumber: e.target.value }))}
                  className="h-10 w-full rounded-lg border border-zinc-200 px-3 text-sm"
                />
                <textarea
                  placeholder="Internal notes"
                  value={form.internalNotes}
                  onChange={(e) => setForm((f) => ({ ...f, internalNotes: e.target.value }))}
                  className="min-h-[80px] w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm"
                />
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void save()}
                  className="h-10 w-full rounded-lg bg-zinc-900 text-sm font-medium text-white disabled:opacity-50"
                >
                  {busy ? "Saving…" : "Save booking details"}
                </button>
              </div>
            ) : (
              <p className="text-sm text-zinc-500">Select an item above to add booking details.</p>
            )}
          </div>
        </SetupAddsPanel>
      }
    />
  );
}
