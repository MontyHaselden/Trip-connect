"use client";

import { useEffect, useState } from "react";

type TripSettings = {
  name: string;
  schoolName: string;
  inviteCode: string;
  viewerCode: string;
  startDate: string;
  endDate: string;
  timezone: string;
  destinationCountry: string | null;
  destinationLanguage: string | null;
};

export function TripSettingsClient(props: { tripId: string }) {
  const [trip, setTrip] = useState<TripSettings | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/trips/${props.tripId}`)
      .then((r) => r.json())
      .then((body) => {
        if (body.trip) setTrip(body.trip);
      })
      .catch(() => null);
  }, [props.tripId]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!trip) return;
    setSaving(true);
    setMessage(null);
    const res = await fetch(`/api/trips/${props.tripId}/settings`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        name: trip.name,
        schoolName: trip.schoolName,
        startDate: trip.startDate,
        endDate: trip.endDate,
        timezone: trip.timezone,
        destinationCountry: trip.destinationCountry,
        destinationLanguage: trip.destinationLanguage,
      }),
    });
    const body = await res.json().catch(() => ({}));
    if (res.ok) {
      setTrip(body.trip);
      setMessage("Settings saved. Publish for students to receive updates.");
    } else {
      setMessage(body.error ?? "Save failed");
    }
    setSaving(false);
  }

  if (!trip) return <p className="text-sm text-zinc-600">Loading…</p>;

  const joinUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/s/${trip.inviteCode}`
      : `/s/${trip.inviteCode}`;

  return (
    <div className="max-w-xl">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold">Trip settings</h1>
        <p className="mt-1 text-sm text-zinc-600">
          Invite code and dates. Changes are drafts until you publish.
        </p>
      </header>

      <div className="mb-6 rounded-2xl border border-zinc-200 bg-white p-5 text-sm">
        <p>
          <span className="font-medium">Student join link:</span>{" "}
          <span className="font-mono text-xs">{joinUrl}</span>
        </p>
        <p className="mt-2">
          <span className="font-medium">Invite code:</span>{" "}
          <span className="font-mono">{trip.inviteCode}</span>
        </p>
      </div>

      {message ? (
        <p className="mb-4 rounded-xl bg-zinc-100 px-3 py-2 text-sm">{message}</p>
      ) : null}

      <form onSubmit={onSubmit} className="space-y-4 rounded-2xl border border-zinc-200 bg-white p-5">
        <label className="block text-sm">
          Trip name
          <input
            value={trip.name}
            onChange={(e) => setTrip({ ...trip, name: e.target.value })}
            className="mt-1 h-10 w-full rounded-lg border border-zinc-200 px-3"
            required
          />
        </label>
        <label className="block text-sm">
          School name
          <input
            value={trip.schoolName}
            onChange={(e) => setTrip({ ...trip, schoolName: e.target.value })}
            className="mt-1 h-10 w-full rounded-lg border border-zinc-200 px-3"
            required
          />
        </label>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block text-sm">
            Start date
            <input
              type="date"
              value={trip.startDate}
              onChange={(e) => setTrip({ ...trip, startDate: e.target.value })}
              className="mt-1 h-10 w-full rounded-lg border border-zinc-200 px-3"
              required
            />
          </label>
          <label className="block text-sm">
            End date
            <input
              type="date"
              value={trip.endDate}
              onChange={(e) => setTrip({ ...trip, endDate: e.target.value })}
              className="mt-1 h-10 w-full rounded-lg border border-zinc-200 px-3"
              required
            />
          </label>
        </div>
        <label className="block text-sm">
          Timezone
          <input
            value={trip.timezone}
            onChange={(e) => setTrip({ ...trip, timezone: e.target.value })}
            className="mt-1 h-10 w-full rounded-lg border border-zinc-200 px-3"
            required
          />
        </label>
        <button
          type="submit"
          disabled={saving}
          className="h-10 w-full rounded-lg bg-zinc-900 text-sm font-medium text-white disabled:opacity-50"
        >
          {saving ? "Saving…" : "Save settings"}
        </button>
      </form>
    </div>
  );
}
