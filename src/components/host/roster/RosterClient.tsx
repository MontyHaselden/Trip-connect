"use client";

import { useCallback, useEffect, useState } from "react";

import { hostJson } from "@/components/host/shared/host-fetch";

import { HostMobileLinkCard } from "@/components/dashboard/HostMobileLinkCard";

import { GroupList } from "./GroupList";
import { ParticipantTable } from "./ParticipantTable";
import { RoomList } from "./RoomList";
import type { RosterPayload } from "./types";

export function RosterClient({
  inviteCode,
  tripId,
}: {
  inviteCode: string;
  tripId?: string;
}) {
  const api = `/api/host/${encodeURIComponent(inviteCode)}`;
  const [roster, setRoster] = useState<RosterPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const data = await hostJson<RosterPayload>(`${api}/roster`);
    setRoster(data);
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

  async function reload() {
    setError(null);
    try {
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Reload failed");
    }
  }

  if (loading) {
    return <p className="text-sm text-zinc-600">Loading participants…</p>;
  }

  if (!roster) {
    return (
      <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-800">
        {error ?? "Failed to load"}
      </p>
    );
  }

  return (
    <main className="flex flex-col gap-5">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">Participants</h1>
        <p className="text-sm text-zinc-600">
          Manage roster, rooms, and groups. Publish for students to see updates.
        </p>
        {tripId ? (
          <div className="mt-3">
            <HostMobileLinkCard tripId={tripId} />
          </div>
        ) : null}
      </header>

      {error ? (
        <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-800">{error}</p>
      ) : null}

      <ParticipantTable
        inviteCode={inviteCode}
        participants={roster.participants}
        rooms={roster.rooms}
        groups={roster.groups}
        onReload={reload}
        onError={setError}
      />
      <RoomList
        inviteCode={inviteCode}
        rooms={roster.rooms}
        onReload={reload}
        onError={setError}
      />
      <GroupList
        inviteCode={inviteCode}
        groups={roster.groups}
        onReload={reload}
        onError={setError}
      />
    </main>
  );
}
