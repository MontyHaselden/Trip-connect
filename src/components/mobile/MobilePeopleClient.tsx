"use client";

import { useEffect, useState } from "react";

import { hostJson } from "@/components/host/shared/host-fetch";
import type { RosterPayload } from "@/components/host/roster/types";

export function MobilePeopleClient(props: { inviteCode: string }) {
  const [roster, setRoster] = useState<RosterPayload | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    hostJson<RosterPayload>(`/api/host/${encodeURIComponent(props.inviteCode)}/roster`)
      .then(setRoster)
      .catch(() => null)
      .finally(() => setLoading(false));
  }, [props.inviteCode]);

  if (loading) return <p className="text-sm text-zinc-600">Loading people…</p>;
  if (!roster) return <p className="text-sm text-red-700">Could not load roster.</p>;

  return (
    <ul className="space-y-2">
      {roster.participants.map((p) => (
        <li
          key={p.id}
          className="rounded-xl border border-zinc-200 bg-white px-4 py-3 shadow-sm"
        >
          <p className="font-medium">{p.fullName}</p>
          <p className="text-xs capitalize text-zinc-500">{p.role}</p>
          {p.roomId ? (
            <p className="mt-1 text-xs text-zinc-600">
              Room:{" "}
              {roster.rooms.find((r) => r.id === p.roomId)?.roomName ?? "Assigned"}
            </p>
          ) : null}
        </li>
      ))}
      {!roster.participants.length ? (
        <li className="text-sm text-zinc-500">No participants yet.</li>
      ) : null}
    </ul>
  );
}
