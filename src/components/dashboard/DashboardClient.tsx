"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { DashboardShell } from "./DashboardShell";

type TripRow = {
  id: string;
  inviteCode: string;
  name: string;
  schoolName: string;
  startDate: string;
  endDate: string;
  publishedVersion: number;
};

export function DashboardClient() {
  const [trips, setTrips] = useState<TripRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/trips")
      .then((r) => r.json())
      .then((body) => {
        if (body.trips) setTrips(body.trips);
        else setError(body.error ?? "Failed to load trips");
      })
      .catch(() => setError("Failed to load trips"))
      .finally(() => setLoading(false));
  }, []);

  return (
    <DashboardShell>
      <div className="mx-auto max-w-4xl px-5 py-10">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold">Your trips</h1>
            <p className="mt-1 text-sm text-zinc-600">Manage school trip itineraries.</p>
          </div>
          <Link
            href="/dashboard/trips/new"
            className="inline-flex h-10 items-center rounded-xl bg-zinc-900 px-4 text-sm font-medium text-white"
          >
            New trip
          </Link>
        </div>
        {error ? (
          <p className="mt-4 text-sm text-red-700">{error}</p>
        ) : null}
        {loading ? (
          <p className="mt-8 text-sm text-zinc-600">Loading…</p>
        ) : (
          <ul className="mt-8 space-y-3">
            {trips.map((t) => (
              <li key={t.id}>
                <Link
                  href={`/dashboard/trips/${t.id}/builder`}
                  className="block rounded-xl border border-zinc-200 bg-white p-4 hover:border-zinc-300"
                >
                  <p className="font-semibold">{t.name}</p>
                  <p className="mt-1 text-sm text-zinc-600">
                    {t.schoolName} · {t.startDate} → {t.endDate}
                  </p>
                  <p className="mt-1 text-xs text-zinc-500">
                    Published v{t.publishedVersion} · invite {t.inviteCode}
                  </p>
                </Link>
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
