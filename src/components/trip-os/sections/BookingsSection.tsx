"use client";

import { useCallback, useEffect, useState } from "react";

import type { TripEntityGraph } from "@/lib/trip-engine/types";
import type { IntercityLegDraft, TransportLegDraft } from "@/lib/host/wizard/types";

function legRouteLabel(leg: TransportLegDraft | IntercityLegDraft): string {
  const ic = leg as IntercityLegDraft;
  if (ic.intercityFromCity && ic.intercityToCity) {
    return `${leg.travelDate} · ${ic.intercityFromCity} → ${ic.intercityToCity}`;
  }
  return `${leg.travelDate} · ${leg.fromCity} → ${leg.toCity}`;
}

type BookingRow = {
  entityType: string;
  entityId: string;
  label: string;
  bookingStatus: string;
  supplier: string | null;
  bookingReference: string | null;
};

export function BookingsSection(props: { graph: TripEntityGraph; tripId: string }) {
  const [rows, setRows] = useState<BookingRow[]>([]);
  const [saving, setSaving] = useState<string | null>(null);

  const loadRows = useCallback(() => {
    const list: BookingRow[] = [];
    for (const stay of props.graph.accommodationStays) {
      if (!stay.name?.trim()) continue;
      const summary = props.graph.bookingsSummary.find(
        (b) => b.entityType === "accommodation_stay" && b.entityId === stay.id,
      );
      list.push({
        entityType: "accommodation_stay",
        entityId: stay.id,
        label: stay.name,
        bookingStatus: summary?.bookingStatus ?? "not_booked",
        supplier: summary?.supplier ?? null,
        bookingReference: summary?.bookingReference ?? null,
      });
    }
    for (const leg of [
      ...props.graph.outboundLegs,
      ...props.graph.returnLegs,
      ...props.graph.intercityLegs,
    ]) {
      const summary = props.graph.bookingsSummary.find(
        (b) => b.entityType === "transport_leg" && b.entityId === leg.id,
      );
      list.push({
        entityType: "transport_leg",
        entityId: leg.id,
        label: legRouteLabel(leg),
        bookingStatus: leg.bookingStatus,
        supplier: summary?.supplier ?? null,
        bookingReference: summary?.bookingReference ?? null,
      });
    }
    setRows(list);
  }, [props.graph]);

  useEffect(() => {
    loadRows();
  }, [loadRows]);

  async function saveBooking(row: BookingRow, patch: { supplier?: string; bookingReference?: string }) {
    setSaving(row.entityId);
    try {
      await fetch(
        `/api/trips/${props.tripId}/booking-details/${row.entityType}/${row.entityId}`,
        {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(patch),
        },
      );
      setRows((current) =>
        current.map((r) =>
          r.entityId === row.entityId
            ? {
                ...r,
                supplier: patch.supplier ?? r.supplier,
                bookingReference: patch.bookingReference ?? r.bookingReference,
              }
            : r,
        ),
      );
    } finally {
      setSaving(null);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Bookings & references</h2>
        <p className="text-sm text-zinc-600">
          Track supplier and reference numbers — overview surfaces invoice gaps.
        </p>
      </div>
      <ul className="space-y-3">
        {rows.map((row) => (
          <li key={row.entityId} className="rounded-xl border border-zinc-200 p-4">
            <p className="font-medium">{row.label}</p>
            <p className="text-xs text-zinc-500">Status: {row.bookingStatus}</p>
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              <input
                defaultValue={row.supplier ?? ""}
                placeholder="Supplier"
                className="rounded-lg border px-3 py-2 text-sm"
                onBlur={(e) => {
                  if (e.target.value !== (row.supplier ?? "")) {
                    void saveBooking(row, { supplier: e.target.value });
                  }
                }}
              />
              <input
                defaultValue={row.bookingReference ?? ""}
                placeholder="Booking reference / invoice #"
                className="rounded-lg border px-3 py-2 text-sm"
                onBlur={(e) => {
                  if (e.target.value !== (row.bookingReference ?? "")) {
                    void saveBooking(row, { bookingReference: e.target.value });
                  }
                }}
              />
            </div>
            {saving === row.entityId ? (
              <p className="mt-1 text-xs text-zinc-500">Saving…</p>
            ) : null}
            {row.bookingStatus === "booked" && !row.bookingReference?.trim() ? (
              <p className="mt-2 text-xs text-amber-800">Booked but no invoice/reference on file.</p>
            ) : null}
          </li>
        ))}
        {!rows.length ? (
          <li className="rounded-lg border border-dashed border-zinc-300 p-4 text-sm text-zinc-500">
            Add stays or transport legs first.
          </li>
        ) : null}
      </ul>
    </div>
  );
}
