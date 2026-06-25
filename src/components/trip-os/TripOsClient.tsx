"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { formatTripDateRangeLabel } from "@/lib/host/trip-date-display";
import type { TripLifecycleStatus } from "@/lib/host/trip-lifecycle";
import { tripOsNewTripPath, tripOsSetupPath } from "@/lib/trip-os/paths";

import { AccountPlanPanel } from "@/components/dashboard/AccountPlanPanel";
import { TripStatusBadge } from "@/components/dashboard/TripStatusBadge";

import { TripEyebrow } from "./shared/TripEyebrow";
import { TripOsNav } from "./TripOsNav";
import { TripPrimaryButton } from "./shared/TripPrimaryButton";

type TripRow = {
  id: string;
  inviteCode: string;
  name: string;
  schoolName: string;
  startDate: string;
  endDate: string;
  publishedVersion: number;
  canDelete: boolean;
  deleteBlockedReason: string | null;
  deleteWarning: string | null;
  status: TripLifecycleStatus;
  statusLabel: string;
  wizardStep: number | null;
  continuePath: string;
};

export function TripOsClient() {
  const [trips, setTrips] = useState<TripRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  async function loadTrips() {
    const res = await fetch("/api/trips");
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(body.error ?? "Failed to load trips");
      return;
    }
    const rows: TripRow[] = (body.trips ?? []).map((t: TripRow) => ({
      ...t,
      continuePath: tripOsSetupPath(t.id),
    }));
    setTrips(rows);
    setError(null);
  }

  useEffect(() => {
    loadTrips().finally(() => setLoading(false));
  }, []);

  async function deleteTrip(trip: TripRow) {
    if (!trip.canDelete || deletingId) return;
    const warning = trip.deleteWarning
      ? `${trip.deleteWarning}\n\n`
      : "";
    const confirmed = window.confirm(
      `${warning}Delete "${trip.name}"? This cannot be undone.`,
    );
    if (!confirmed) return;

    setDeletingId(trip.id);
    setError(null);
    try {
      const res = await fetch(`/api/trips/${trip.id}`, { method: "DELETE" });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || "Failed to delete trip");
      setTrips((current) => current.filter((row) => row.id !== trip.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete trip");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="trip-os flex h-dvh min-h-0 bg-white">
      <TripOsNav variant="list" />
      <main className="trip-os-workspace min-w-0 flex-1 overflow-y-auto px-8 py-10">
        <div className="relative mx-auto max-w-2xl">
          <div
            aria-hidden
            className="pointer-events-none absolute -left-16 -top-8 h-64 w-64 rounded-full bg-gradient-to-br from-violet-400/20 to-transparent blur-3xl"
          />

          <div className="relative flex items-start justify-between gap-4">
            <div>
              <TripEyebrow accent>Trip OS</TripEyebrow>
              <h1 className="mt-2 text-3xl font-semibold tracking-tight text-zinc-900">
                Your trips
              </h1>
              <p className="mt-2 text-sm text-zinc-500">
                Open a trip to build the itinerary — or start fresh.
              </p>
            </div>
            <Link href={tripOsNewTripPath()}>
              <TripPrimaryButton variant="violet">New trip</TripPrimaryButton>
            </Link>
          </div>

          <div className="mt-8">
            <AccountPlanPanel />
          </div>

          {error ? <p className="mt-4 text-sm text-red-700">{error}</p> : null}

          {loading ? (
            <p className="mt-10 text-sm text-zinc-500">Loading…</p>
          ) : (
            <ul className="mt-10 space-y-2">
              {trips.map((t) => (
                <li key={t.id}>
                  <div className="group flex items-stretch gap-2 rounded-2xl bg-white shadow-sm transition hover:shadow-md">
                    <Link href={t.continuePath} className="min-w-0 flex-1 px-5 py-4">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-semibold text-zinc-900">{t.name}</p>
                        <TripStatusBadge status={t.status} label={t.statusLabel} />
                      </div>
                      <p className="mt-1 text-sm text-zinc-500">
                        {t.schoolName} · {formatTripDateRangeLabel(t.startDate, t.endDate)}
                      </p>
                      <p className="mt-0.5 text-xs text-zinc-400">
                        Published v{t.publishedVersion} · invite {t.inviteCode}
                      </p>
                    </Link>
                    {t.canDelete ? (
                      <button
                        type="button"
                        onClick={() => deleteTrip(t)}
                        disabled={deletingId === t.id}
                        className="shrink-0 self-center rounded-full border border-red-200 px-4 py-2 text-sm font-medium text-red-700 transition hover:bg-red-50 disabled:opacity-50"
                      >
                        {deletingId === t.id ? "Deleting…" : "Delete"}
                      </button>
                    ) : t.deleteBlockedReason ? (
                      <span
                        className="shrink-0 self-center px-3 text-xs text-zinc-400"
                        title={t.deleteBlockedReason}
                      >
                        Locked
                      </span>
                    ) : null}
                  </div>
                </li>
              ))}
              {!trips.length ? (
                <li className="rounded-2xl bg-white px-8 py-12 text-center shadow-sm">
                  <p className="text-sm text-zinc-500">No trips yet.</p>
                  <Link
                    href={tripOsNewTripPath()}
                    className="mt-3 inline-block text-sm font-medium text-violet-600 hover:text-violet-700"
                  >
                    Create your first trip →
                  </Link>
                </li>
              ) : null}
            </ul>
          )}
        </div>
      </main>
    </div>
  );
}
