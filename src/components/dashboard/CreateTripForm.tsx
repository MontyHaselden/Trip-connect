"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import { DashboardShell } from "./DashboardShell";

export function CreateTripForm() {
  const router = useRouter();
  const tzDefault = useMemo(() => {
    try {
      return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
    } catch {
      return "UTC";
    }
  }, []);

  const [name, setName] = useState("Japan School Trip");
  const [schoolName, setSchoolName] = useState("");
  const [destinationCountry, setDestinationCountry] = useState("Japan");
  const [destinationLanguage, setDestinationLanguage] = useState("ja");
  const [timezone, setTimezone] = useState("Asia/Tokyo");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function createTrip() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/trips", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name,
          schoolName,
          timezone: timezone || tzDefault,
          defaultCountryCallingCode: "NZ",
          destinationCountry,
          destinationLanguage,
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || "Failed to create trip");
      router.push(`/dashboard/trips/${body.tripId}/builder`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <DashboardShell>
      <div className="mx-auto max-w-lg px-5 py-10">
        <h1 className="text-2xl font-semibold">Create a trip</h1>
        <p className="mt-2 text-sm text-zinc-600">
          Set up the basics, then describe your itinerary in the AI builder — dates are
          worked out automatically from your schedule.
        </p>
        {error ? <p className="mt-4 text-sm text-red-700">{error}</p> : null}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            createTrip();
          }}
          className="mt-6 space-y-4"
        >
          <label className="block">
            <span className="text-sm font-medium">Trip name</span>
            <input
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1 h-11 w-full rounded-xl border border-zinc-200 px-3 text-sm"
            />
          </label>
          <label className="block">
            <span className="text-sm font-medium">School name</span>
            <input
              required
              value={schoolName}
              onChange={(e) => setSchoolName(e.target.value)}
              className="mt-1 h-11 w-full rounded-xl border border-zinc-200 px-3 text-sm"
            />
          </label>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="text-sm font-medium">Destination country</span>
              <input
                value={destinationCountry}
                onChange={(e) => setDestinationCountry(e.target.value)}
                className="mt-1 h-11 w-full rounded-xl border border-zinc-200 px-3 text-sm"
              />
            </label>
            <label className="block">
              <span className="text-sm font-medium">Language code</span>
              <input
                value={destinationLanguage}
                onChange={(e) => setDestinationLanguage(e.target.value)}
                className="mt-1 h-11 w-full rounded-xl border border-zinc-200 px-3 text-sm"
              />
            </label>
          </div>
          <label className="block">
            <span className="text-sm font-medium">Timezone</span>
            <input
              value={timezone}
              onChange={(e) => setTimezone(e.target.value)}
              className="mt-1 h-11 w-full rounded-xl border border-zinc-200 px-3 text-sm"
            />
          </label>
          <button
            type="submit"
            disabled={busy}
            className="h-11 w-full rounded-xl bg-zinc-900 text-sm font-medium text-white disabled:opacity-50"
          >
            {busy ? "Creating…" : "Create trip"}
          </button>
        </form>
        <p className="mt-6 text-center text-sm text-zinc-600">
          Or load the{" "}
          <button
            type="button"
            onClick={() => router.push("/demo")}
            className="font-medium text-zinc-900 underline"
          >
            demo Japan trip
          </button>{" "}
          after running the seed script.
        </p>
      </div>
    </DashboardShell>
  );
}
