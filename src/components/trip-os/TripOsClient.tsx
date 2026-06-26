"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import type { SchoolAccountSnapshot } from "@/components/dashboard/SchoolAccountCard";
import { SchoolAccountCard } from "@/components/dashboard/SchoolAccountCard";
import { formatTripListDateLabel } from "@/lib/host/trip-date-display";
import type { TripLifecycleStatus } from "@/lib/host/trip-lifecycle";
import { createTripShellClient } from "@/lib/trip-os/create-trip-client";
import { tripOsSetupPath } from "@/lib/trip-os/paths";

import { TripStatusBadge } from "./shared/TripStatusBadge";
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

function tripStudentLine(trip: TripRow): string {
  if (trip.publishedVersion > 0) {
    return `Live for students · invite ${trip.inviteCode}`;
  }
  return `Invite code ${trip.inviteCode} · not published yet`;
}

export function TripOsClient() {
  const router = useRouter();
  const [trips, setTrips] = useState<TripRow[]>([]);
  const [account, setAccount] = useState<SchoolAccountSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [creatingTrip, setCreatingTrip] = useState(false);

  async function loadDashboard() {
    const [tripsRes, accountRes] = await Promise.all([
      fetch("/api/trips"),
      fetch("/api/account/me"),
    ]);

    const tripsBody = await tripsRes.json().catch(() => ({}));
    if (!tripsRes.ok) {
      setError(tripsBody.error ?? "Failed to load trips");
      return;
    }

    const rows: TripRow[] = (tripsBody.trips ?? []).map((t: TripRow) => ({
      ...t,
      continuePath: tripOsSetupPath(t.id),
    }));
    setTrips(rows);

    const accountBody = await accountRes.json().catch(() => ({}));
    if (accountRes.ok && accountBody.account) {
      setAccount(accountBody as SchoolAccountSnapshot);
    }

    setError(null);
  }

  useEffect(() => {
    loadDashboard().finally(() => setLoading(false));
  }, []);

  async function startNewTrip() {
    if (creatingTrip) return;
    setCreatingTrip(true);
    setError(null);
    try {
      const result = await createTripShellClient();
      if (!result.ok) throw new Error(result.error);
      router.push(tripOsSetupPath(result.tripId));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create trip");
      setCreatingTrip(false);
    }
  }

  async function deleteTrip(trip: TripRow) {
    if (!trip.canDelete || deletingId) return;
    const warning = trip.deleteWarning ? `${trip.deleteWarning}\n\n` : "";
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
      if (account) {
        setAccount({
          ...account,
          usage: {
            ...account.usage,
            activeTrips: Math.max(0, account.usage.activeTrips - 1),
          },
        });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete trip");
    } finally {
      setDeletingId(null);
    }
  }

  const schoolName =
    account?.account.schoolName?.trim() ||
    trips.find((t) => t.schoolName.trim())?.schoolName.trim() ||
    null;

  return (
    <div className="trip-os flex h-dvh min-h-0 bg-white">
      <TripOsNav variant="list" schoolName={schoolName} />
      <main className="trip-os-workspace min-w-0 flex-1 overflow-y-auto px-6 py-8 sm:px-10 sm:py-10">
        <div className="mx-auto max-w-3xl">
          <header className="flex flex-wrap items-start justify-between gap-4 border-b border-zinc-200/80 pb-8">
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-violet-600">
                Trip OS
              </p>
              <h1 className="mt-2 text-3xl font-semibold tracking-tight text-zinc-900">
                {schoolName ?? "School dashboard"}
              </h1>
              <p className="mt-2 max-w-lg text-sm leading-relaxed text-zinc-500">
                Your trips, staff, and student invites — everything before you open a trip lives
                here.
              </p>
            </div>
            <TripPrimaryButton
              variant="violet"
              type="button"
              disabled={creatingTrip}
              onClick={() => void startNewTrip()}
              className="shrink-0"
            >
              {creatingTrip ? "Creating…" : "New trip"}
            </TripPrimaryButton>
          </header>

          {account ? (
            <div className="mt-8">
              <SchoolAccountCard data={account} />
            </div>
          ) : null}

          {error ? (
            <p className="mt-6 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>
          ) : null}

          <section className="mt-10">
            <div className="mb-4 flex items-end justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-zinc-900">Trips</h2>
                <p className="mt-0.5 text-sm text-zinc-500">
                  {loading
                    ? "Loading…"
                    : trips.length
                      ? `${trips.length} trip${trips.length === 1 ? "" : "s"}`
                      : "No trips yet"}
                </p>
              </div>
            </div>

            {loading ? (
              <div className="space-y-3">
                {[0, 1].map((i) => (
                  <div
                    key={i}
                    className="h-28 animate-pulse rounded-2xl border border-zinc-200/60 bg-white"
                  />
                ))}
              </div>
            ) : trips.length ? (
              <ul className="space-y-3">
                {trips.map((trip) => {
                  const dateLabel = formatTripListDateLabel(trip.startDate, trip.endDate);
                  return (
                    <li key={trip.id}>
                      <div className="group flex items-stretch overflow-hidden rounded-2xl border border-zinc-200/80 bg-white shadow-sm transition hover:border-zinc-300 hover:shadow-md">
                        <Link href={trip.continuePath} className="min-w-0 flex-1 px-5 py-4">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="text-base font-semibold text-zinc-900">{trip.name}</p>
                            <TripStatusBadge status={trip.status} label={trip.statusLabel} />
                          </div>
                          {dateLabel ? (
                            <p className="mt-1.5 text-sm text-zinc-600">{dateLabel}</p>
                          ) : null}
                          <p className="mt-1 text-sm text-zinc-500">{tripStudentLine(trip)}</p>
                        </Link>
                        <div className="flex shrink-0 flex-col items-stretch justify-center gap-2 border-l border-zinc-100 px-3 py-3 sm:flex-row sm:items-center sm:px-4">
                          <Link
                            href={trip.continuePath}
                            className="inline-flex items-center justify-center rounded-full bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-zinc-800"
                          >
                            Open
                          </Link>
                          {trip.canDelete ? (
                            <button
                              type="button"
                              onClick={() => deleteTrip(trip)}
                              disabled={deletingId === trip.id}
                              className="rounded-full border border-zinc-200 px-4 py-2 text-sm font-medium text-zinc-600 transition hover:border-red-200 hover:bg-red-50 hover:text-red-700 disabled:opacity-50"
                            >
                              {deletingId === trip.id ? "Deleting…" : "Delete"}
                            </button>
                          ) : trip.deleteBlockedReason ? (
                            <span
                              className="px-2 text-center text-xs text-zinc-400"
                              title={trip.deleteBlockedReason}
                            >
                              Locked
                            </span>
                          ) : null}
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <div className="rounded-2xl border border-dashed border-zinc-300 bg-white px-8 py-14 text-center">
                <p className="text-base font-medium text-zinc-900">No trips yet</p>
                <p className="mx-auto mt-2 max-w-sm text-sm text-zinc-500">
                  Create a trip to set dates, build the itinerary, and share invite links with
                  students.
                </p>
                <button
                  type="button"
                  onClick={() => void startNewTrip()}
                  disabled={creatingTrip}
                  className="mt-5 text-sm font-medium text-violet-600 hover:text-violet-700 disabled:opacity-50"
                >
                  {creatingTrip ? "Creating…" : "Create your first trip →"}
                </button>
              </div>
            )}
          </section>
        </div>
      </main>
    </div>
  );
}
