"use client";

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";

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
};

export default function HostSettingsPage() {
  const params = useParams();
  const inviteCode = String(params.inviteCode ?? "");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [schoolName, setSchoolName] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [destinationCountry, setDestinationCountry] = useState("");
  const [destinationLanguage, setDestinationLanguage] = useState("");
  const [timezone, setTimezone] = useState("");
  const [defaultCountryCallingCode, setDefaultCountryCallingCode] = useState("");

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch(`/api/host/${encodeURIComponent(inviteCode)}/trip`);
        const body = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(body?.error || "Failed to load trip");
        const t = body as HostTripResponse;
        if (cancelled) return;
        setName(t.name);
        setSchoolName(t.schoolName);
        setStartDate(t.startDate);
        setEndDate(t.endDate);
        setDestinationCountry(t.destinationCountry ?? "");
        setDestinationLanguage(t.destinationLanguage ?? "");
        setTimezone(t.timezone);
        setDefaultCountryCallingCode(t.defaultCountryCallingCode);
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

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch(`/api/host/${encodeURIComponent(inviteCode)}/trip`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name,
          schoolName,
          startDate,
          endDate,
          destinationCountry: destinationCountry.trim() || null,
          destinationLanguage: destinationLanguage.trim() || null,
          timezone,
          defaultCountryCallingCode,
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body?.error || "Save failed");
      setSuccess("Settings saved. Publish updates for students to receive changes.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <main className="flex flex-col gap-4">
        <p className="text-sm text-zinc-600">Loading settings…</p>
      </main>
    );
  }

  return (
    <main className="flex flex-col gap-5">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">Trip settings</h1>
        <p className="text-sm text-zinc-600">
          Changes are saved as drafts. Students only see updates after you publish.
        </p>
      </header>

      {error ? (
        <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-800">{error}</p>
      ) : null}
      {success ? (
        <p className="rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
          {success}
        </p>
      ) : null}

      <form
        onSubmit={onSubmit}
        className="rounded-2xl border border-zinc-200 bg-white p-5"
      >
        <div className="space-y-4">
          <label className="block">
            <span className="text-sm font-medium">Trip name</span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-2 h-11 w-full rounded-xl border border-zinc-200 px-3 text-sm"
              required
            />
          </label>
          <label className="block">
            <span className="text-sm font-medium">School name</span>
            <input
              value={schoolName}
              onChange={(e) => setSchoolName(e.target.value)}
              className="mt-2 h-11 w-full rounded-xl border border-zinc-200 px-3 text-sm"
              required
            />
          </label>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="text-sm font-medium">Start date</span>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="mt-2 h-11 w-full rounded-xl border border-zinc-200 px-3 text-sm"
                required
              />
            </label>
            <label className="block">
              <span className="text-sm font-medium">End date</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="mt-2 h-11 w-full rounded-xl border border-zinc-200 px-3 text-sm"
                required
              />
            </label>
          </div>
          <label className="block">
            <span className="text-sm font-medium">Timezone</span>
            <input
              value={timezone}
              onChange={(e) => setTimezone(e.target.value)}
              placeholder="Asia/Tokyo"
              className="mt-2 h-11 w-full rounded-xl border border-zinc-200 px-3 text-sm"
              required
            />
          </label>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="text-sm font-medium">Destination country</span>
              <input
                value={destinationCountry}
                onChange={(e) => setDestinationCountry(e.target.value)}
                placeholder="Japan"
                className="mt-2 h-11 w-full rounded-xl border border-zinc-200 px-3 text-sm"
              />
            </label>
            <label className="block">
              <span className="text-sm font-medium">Destination language</span>
              <input
                value={destinationLanguage}
                onChange={(e) => setDestinationLanguage(e.target.value)}
                placeholder="ja"
                className="mt-2 h-11 w-full rounded-xl border border-zinc-200 px-3 text-sm"
              />
            </label>
          </div>
          <label className="block">
            <span className="text-sm font-medium">Default phone country (ISO)</span>
            <input
              value={defaultCountryCallingCode}
              onChange={(e) => setDefaultCountryCallingCode(e.target.value.toUpperCase())}
              placeholder="NZ"
              maxLength={2}
              className="mt-2 h-11 w-full rounded-xl border border-zinc-200 px-3 text-sm uppercase"
              required
            />
            <p className="mt-1 text-xs text-zinc-600">
              Used when students enter phone numbers without a country code.
            </p>
          </label>
        </div>

        <button
          type="submit"
          disabled={saving}
          className="mt-6 inline-flex h-11 w-full items-center justify-center rounded-xl bg-zinc-900 px-4 text-sm font-medium text-white disabled:opacity-50"
        >
          {saving ? "Saving…" : "Save settings"}
        </button>
      </form>
    </main>
  );
}
