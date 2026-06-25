"use client";

import { useCallback, useEffect, useState } from "react";

import type { TripEntityGraph } from "@/lib/trip-engine/types";
import type { IntercityLegDraft, TransportLegDraft } from "@/lib/host/wizard/types";

import { transportLegRouteLabel } from "@/lib/trip-engine/transport-route-label";

import { TripInput } from "../shared/TripInput";
import { TripSectionShell } from "../shared/TripSectionShell";

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
        label: transportLegRouteLabel(leg, props.graph),
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
    <TripSectionShell
      eyebrow="References"
      title="Bookings & references"
      description="Track supplier and reference numbers — overview surfaces invoice gaps."
    >
      <ul className="space-y-3">
        {rows.map((row) => (
          <li key={row.entityId} className="rounded-2xl bg-zinc-50/80 p-5">
            <p className="font-medium text-zinc-900">{row.label}</p>
            <p className="text-xs text-zinc-500">Status: {row.bookingStatus}</p>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              <TripInput
                defaultValue={row.supplier ?? ""}
                placeholder="Supplier"
                onBlur={(e) => {
                  if (e.target.value !== (row.supplier ?? "")) {
                    void saveBooking(row, { supplier: e.target.value });
                  }
                }}
              />
              <TripInput
                defaultValue={row.bookingReference ?? ""}
                placeholder="Booking reference / invoice #"
                onBlur={(e) => {
                  if (e.target.value !== (row.bookingReference ?? "")) {
                    void saveBooking(row, { bookingReference: e.target.value });
                  }
                }}
              />
            </div>
            {saving === row.entityId ? (
              <p className="mt-2 text-xs text-zinc-500">Saving…</p>
            ) : null}
            {row.bookingStatus === "booked" && !row.bookingReference?.trim() ? (
              <p className="mt-2 text-xs text-amber-800">Booked but no invoice/reference on file.</p>
            ) : null}
          </li>
        ))}
        {!rows.length ? (
          <li className="rounded-2xl bg-zinc-50/80 px-4 py-6 text-center text-sm text-zinc-500">
            Add stays or transport legs first.
          </li>
        ) : null}
      </ul>
    </TripSectionShell>
  );
}
