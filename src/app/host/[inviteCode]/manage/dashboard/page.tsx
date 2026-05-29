"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

type HostTripResponse = {
  id: string;
  name: string;
  schoolName: string;
  inviteCode: string;
  startDate: string;
  endDate: string;
  destinationCountry: string | null;
  destinationLanguage: string | null;
  timezone: string;
  defaultCountryCallingCode: string;
  publishedVersion: number;
  lastPublishedAt: string | null;
  needsPublishConfirm: boolean;
};

const shortcuts = [
  { href: "itinerary", label: "Itinerary" },
  { href: "participants", label: "Participants" },
  { href: "contacts", label: "Contacts" },
  { href: "phrases", label: "Phrases" },
  { href: "publish", label: "Publish" },
  { href: "team", label: "Team" },
] as const;

export default function HostDashboardPage() {
  const params = useParams();
  const inviteCode = String(params.inviteCode ?? "");
  const base = `/host/${encodeURIComponent(inviteCode)}/manage`;

  const [trip, setTrip] = useState<HostTripResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const joinUrl = useMemo(() => {
    if (typeof window === "undefined") return "";
    return `${window.location.origin}/join/${encodeURIComponent(inviteCode)}`;
  }, [inviteCode]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch(`/api/host/${encodeURIComponent(inviteCode)}/trip`);
        const body = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(body?.error || "Failed to load trip");
        if (!cancelled) setTrip(body as HostTripResponse);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load trip");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [inviteCode]);

  async function copyJoinLink() {
    if (!joinUrl) return;
    try {
      await navigator.clipboard.writeText(joinUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  if (loading) {
    return (
      <main className="flex flex-col gap-4">
        <p className="text-sm text-zinc-600">Loading dashboard…</p>
      </main>
    );
  }

  if (error || !trip) {
    return (
      <main className="flex flex-col gap-4">
        <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-800">
          {error ?? "Trip not found"}
        </p>
      </main>
    );
  }

  const showSetupHint = trip.publishedVersion === 0;

  return (
    <main className="flex flex-col gap-5">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
        <p className="text-sm text-zinc-600">{trip.name}</p>
      </header>

      {trip.needsPublishConfirm ? (
        <section className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          This trip is live. Draft changes need confirm publish before students
          see them.
        </section>
      ) : trip.publishedVersion > 0 ? (
        <section className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-950">
          Published v{trip.publishedVersion}
          {trip.lastPublishedAt
            ? ` · ${new Date(trip.lastPublishedAt).toLocaleString()}`
            : ""}
        </section>
      ) : (
        <section className="rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-700">
          Not published yet — edits go live automatically until students join.
        </section>
      )}

      {showSetupHint ? (
        <section className="rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-700">
          Build your trip: add an itinerary (or import from text), contacts, and
          emergency phrases, then share the join link when ready.
        </section>
      ) : null}

      <section className="rounded-2xl border border-zinc-200 bg-white p-5">
        <h2 className="text-base font-semibold">Manage trip</h2>
        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
          {shortcuts.map((s) => (
            <Link
              key={s.href}
              href={`${base}/${s.href}`}
              className="inline-flex h-11 items-center justify-center rounded-xl border border-zinc-200 bg-zinc-50 px-3 text-sm font-medium text-zinc-900"
            >
              {s.label}
            </Link>
          ))}
          <Link
            href={`${base}/settings`}
            className="inline-flex h-11 items-center justify-center rounded-xl border border-zinc-200 bg-zinc-50 px-3 text-sm font-medium text-zinc-900"
          >
            Settings
          </Link>
        </div>
      </section>

      <section className="rounded-2xl border border-zinc-200 bg-white p-5">
        <h2 className="text-base font-semibold">Trip overview</h2>
        <dl className="mt-3 space-y-3 text-sm">
          <div>
            <dt className="text-xs text-zinc-500">School</dt>
            <dd className="font-medium text-zinc-900">{trip.schoolName}</dd>
          </div>
          <div>
            <dt className="text-xs text-zinc-500">Dates</dt>
            <dd className="font-medium text-zinc-900">
              {trip.startDate} → {trip.endDate}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-zinc-500">Timezone</dt>
            <dd className="font-medium text-zinc-900">{trip.timezone}</dd>
          </div>
          <div>
            <dt className="text-xs text-zinc-500">Destination</dt>
            <dd className="font-medium text-zinc-900">
              {trip.destinationCountry ?? "—"}
              {trip.destinationLanguage
                ? ` (${trip.destinationLanguage})`
                : ""}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-zinc-500">Published version</dt>
            <dd className="font-medium text-zinc-900">
              {trip.publishedVersion === 0
                ? "Not published yet"
                : `v${trip.publishedVersion}`}
              {trip.lastPublishedAt ? (
                <span className="mt-1 block text-xs font-normal text-zinc-600">
                  Last published {new Date(trip.lastPublishedAt).toLocaleString()}
                </span>
              ) : null}
            </dd>
          </div>
        </dl>
      </section>

      <section className="rounded-2xl border border-zinc-200 bg-white p-5">
        <h2 className="text-base font-semibold">Student join link</h2>
        <p className="mt-2 text-sm text-zinc-600">
          Share this link with students. They join with name and phone number only.
        </p>
        <p className="mt-3 break-all rounded-xl bg-zinc-50 px-3 py-2 font-mono text-xs text-zinc-800">
          {joinUrl || `/join/${inviteCode}`}
        </p>
        <button
          type="button"
          onClick={copyJoinLink}
          className="mt-3 inline-flex h-10 items-center justify-center rounded-xl border border-zinc-200 bg-white px-4 text-sm font-medium"
        >
          {copied ? "Copied" : "Copy link"}
        </button>
      </section>
    </main>
  );
}
