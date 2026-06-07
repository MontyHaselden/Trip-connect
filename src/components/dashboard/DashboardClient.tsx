"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { formatTripDateRangeLabel } from "@/lib/host/trip-date-display";

import type { TripLifecycleStatus } from "@/lib/host/trip-lifecycle";

import { AccountPlanPanel } from "./AccountPlanPanel";
import { DashboardShell } from "./DashboardShell";
import { TripStatusBadge } from "./TripStatusBadge";

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
  status: TripLifecycleStatus;
  statusLabel: string;
  wizardStep: number | null;
  continuePath: string;
};

export function DashboardClient() {
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
    setTrips(body.trips ?? []);
    setError(null);
  }

  useEffect(() => {
    loadTrips().finally(() => setLoading(false));
  }, []);

  async function deleteTrip(trip: TripRow) {
    if (!trip.canDelete || deletingId) return;
    const confirmed = window.confirm(
      `Delete “${trip.name}”? This draft trip and any partial itinerary will be removed permanently.`,
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
    <DashboardShell>
      <div className="mx-auto max-w-4xl px-5 py-10">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold">Your trips</h1>
            <p className="mt-1 text-sm text-zinc-600">
              Manage live school trip hubs — or personal group trips.
            </p>
          </div>
          <Link
            href="/dashboard/trips/new"
            className="inline-flex h-10 items-center rounded-xl bg-zinc-900 px-4 text-sm font-medium text-white"
          >
            New trip
          </Link>
        </div>
        <AccountPlanPanel />
        {error ? (
          <p className="mt-4 text-sm text-red-700">{error}</p>
        ) : null}
        {loading ? (
          <p className="mt-8 text-sm text-zinc-600">Loading…</p>
        ) : (
          <ul className="mt-8 space-y-3">
            {trips.map((t) => (
              <li key={t.id}>
                <div className="flex items-stretch gap-2 rounded-xl border border-zinc-200 bg-white hover:border-zinc-300">
                  <Link href={t.continuePath} className="min-w-0 flex-1 p-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-semibold">{t.name}</p>
                      <TripStatusBadge status={t.status} label={t.statusLabel} />
                    </div>
                    <p className="mt-1 text-sm text-zinc-600">
                      {t.schoolName} · {formatTripDateRangeLabel(t.startDate, t.endDate)}
                    </p>
                    <p className="mt-1 text-xs text-zinc-500">
                      {t.status === "building" && t.wizardStep
                        ? `Setup in progress · step ${t.wizardStep} of 8`
                        : null}
                      {t.status === "building" && t.wizardStep ? " · " : null}
                      Published v{t.publishedVersion} · invite {t.inviteCode}
                    </p>
                    {!t.canDelete && t.deleteBlockedReason ? (
                      <p className="mt-2 text-xs text-zinc-500">{t.deleteBlockedReason}</p>
                    ) : null}
                  </Link>
                  {t.canDelete ? (
                    <button
                      type="button"
                      onClick={() => deleteTrip(t)}
                      disabled={deletingId === t.id}
                      className="shrink-0 self-center rounded-lg px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-50 disabled:opacity-50"
                    >
                      {deletingId === t.id ? "Deleting…" : "Delete"}
                    </button>
                  ) : null}
                </div>
              </li>
            ))}
            {!trips.length ? (
              <li className="rounded-xl border border-dashed border-zinc-300 p-8 text-center text-sm text-zinc-600">
                No trips yet.{" "}
                <Link href="/dashboard/trips/new" className="font-medium text-zinc-900">
                  Create one
                </Link>{" "}
                or run <code className="rounded bg-zinc-100 px-1">npm run seed:japan</code>.
              </li>
            ) : null}
          </ul>
        )}
      </div>
    </DashboardShell>
  );
}
