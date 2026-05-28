"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { hostJson } from "@/components/host/shared/host-fetch";

import { DayEditor } from "./DayEditor";
import { DayList } from "./DayList";
import { GenerateDaysButton } from "./GenerateDaysButton";
import { ItemList } from "./ItemList";
import { ImportFromText } from "./ImportFromText";
import { PrepList } from "./PrepList";
import type { ItineraryTree, RosterSummary } from "./types";

type HostTrip = {
  startDate: string;
  endDate: string;
  needsPublishConfirm?: boolean;
};

export function ItineraryClient({ inviteCode }: { inviteCode: string }) {
  const api = `/api/host/${encodeURIComponent(inviteCode)}`;

  const [trip, setTrip] = useState<HostTrip | null>(null);
  const [tree, setTree] = useState<ItineraryTree | null>(null);
  const [roster, setRoster] = useState<RosterSummary | null>(null);
  const [selectedDayId, setSelectedDayId] = useState<string | null>(null);
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editingPrepId, setEditingPrepId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [newDate, setNewDate] = useState("");
  const [newCity, setNewCity] = useState("");

  const load = useCallback(async () => {
    const [t, it, ro] = await Promise.all([
      hostJson<HostTrip>(`${api}/trip`),
      hostJson<ItineraryTree>(`${api}/itinerary`),
      hostJson<{
        rooms: { id: string; roomName: string }[];
        groups: { id: string; name: string }[];
        participants: { id: string; fullName: string }[];
      }>(`${api}/roster`),
    ]);
    setTrip(t);
    setTree(it);
    setRoster({
      rooms: ro.rooms,
      groups: ro.groups,
      participants: ro.participants,
    });
    setSelectedDayId((prev) => {
      if (prev && it.days.some((d) => d.id === prev)) return prev;
      return it.days[0]?.id ?? null;
    });
  }, [api]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await load();
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [load]);

  const selectedDay = useMemo(
    () => tree?.days.find((d) => d.id === selectedDayId) ?? null,
    [tree, selectedDayId],
  );

  async function reload() {
    setBusy(true);
    setError(null);
    try {
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Reload failed");
    } finally {
      setBusy(false);
    }
  }

  async function addDay(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const created = await hostJson<{ id: string }>(`${api}/days`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          date: newDate,
          cityLabel: newCity.trim(),
        }),
      });
      setNewDate("");
      setNewCity("");
      await load();
      setSelectedDayId(created.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Add day failed");
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return <p className="text-sm text-zinc-600">Loading itinerary…</p>;
  }

  if (!trip || !tree || !roster) {
    return (
      <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-800">
        {error ?? "Failed to load"}
      </p>
    );
  }

  return (
    <main className="flex flex-col gap-5">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">Itinerary</h1>
        <p className="text-sm text-zinc-600">
          Students won&apos;t see changes until you publish.
        </p>
      </header>

      {error ? (
        <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-800">{error}</p>
      ) : null}

      <ImportFromText
        inviteCode={inviteCode}
        needsPublishConfirm={trip?.needsPublishConfirm ?? false}
        onImported={reload}
        onError={setError}
      />

      {trip?.needsPublishConfirm ? (
        <section className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          Students with cached data need a confirmed publish before they receive
          updates. Use the Publish tab to review and send changes.
        </section>
      ) : (
        <section className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-950">
          Changes go live automatically while no students have joined. Students
          see updates when they join or tap Refresh trip data.
        </section>
      )}

      <section className="rounded-2xl border border-zinc-200 bg-white p-5">
        <h2 className="text-base font-semibold">Trip days</h2>
        <div className="mt-3">
          <DayList
            days={tree.days}
            selectedId={selectedDayId}
            onSelect={(id) => {
              setSelectedDayId(id);
              setEditingItemId(null);
              setEditingPrepId(null);
            }}
          />
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <GenerateDaysButton
            inviteCode={inviteCode}
            busy={busy}
            onDone={reload}
            onError={setError}
          />
        </div>
        <form onSubmit={addDay} className="mt-4 grid gap-3 sm:grid-cols-3">
          <input
            type="date"
            required
            min={trip.startDate}
            max={trip.endDate}
            value={newDate}
            onChange={(e) => setNewDate(e.target.value)}
            className="h-10 rounded-xl border border-zinc-200 px-3 text-sm"
          />
          <input
            required
            placeholder="City label"
            value={newCity}
            onChange={(e) => setNewCity(e.target.value)}
            className="h-10 rounded-xl border border-zinc-200 px-3 text-sm sm:col-span-2"
          />
          <button
            type="submit"
            disabled={busy}
            className="h-10 rounded-xl bg-zinc-900 text-sm font-medium text-white disabled:opacity-50 sm:col-span-3"
          >
            Add day
          </button>
        </form>
      </section>

      {selectedDay ? (
        <>
          <DayEditor
            inviteCode={inviteCode}
            day={selectedDay}
            tripStart={trip.startDate}
            tripEnd={trip.endDate}
            onUpdated={reload}
            onDeleted={() => {
              setSelectedDayId(null);
              reload();
            }}
            onError={setError}
          />
          <ItemList
            inviteCode={inviteCode}
            day={selectedDay}
            roster={roster}
            editingId={editingItemId}
            onEdit={setEditingItemId}
            onReload={reload}
            onError={setError}
          />
          <PrepList
            inviteCode={inviteCode}
            day={selectedDay}
            editingId={editingPrepId}
            onEdit={setEditingPrepId}
            onReload={reload}
            onError={setError}
          />
        </>
      ) : null}
    </main>
  );
}
