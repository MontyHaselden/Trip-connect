"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { GroupInviteLinks } from "@/components/host/roster/GroupInviteLinks";
import { hostJson } from "@/components/host/shared/host-fetch";
import type { RosterPayload } from "@/components/host/roster/types";
import { studentAppPath } from "@/lib/mobile/student-app-paths";
import type { TripEntityGraph } from "@/lib/trip-engine/types";

import { TripSectionShell, TripSoftPanel } from "../shared/TripSectionShell";

function joinUrl(inviteCode: string) {
  if (typeof window === "undefined") return studentAppPath(inviteCode);
  return `${window.location.origin}${studentAppPath(inviteCode)}`;
}

function CopyLinkRow(props: { url: string; label?: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(props.url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore
    }
  }

  return (
    <div className="space-y-2">
      {props.label ? (
        <p className="text-xs font-medium text-zinc-500">{props.label}</p>
      ) : null}
      <div className="flex flex-wrap items-center gap-2">
        <code className="min-w-0 flex-1 break-all rounded-xl bg-white px-3 py-2 text-sm text-zinc-800 shadow-sm">
          {props.url}
        </code>
        <button
          type="button"
          onClick={() => void copy()}
          className="shrink-0 rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm font-medium text-zinc-700 shadow-sm transition hover:bg-zinc-50"
        >
          {copied ? "Copied" : "Copy"}
        </button>
        <a
          href={props.url}
          target="_blank"
          rel="noopener noreferrer"
          className="shrink-0 rounded-xl bg-violet-600 px-3 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-violet-700"
        >
          Open
        </a>
      </div>
    </div>
  );
}

export function JoinLinksSection(props: {
  inviteCode: string;
  graph: TripEntityGraph;
}) {
  const { inviteCode, graph } = props;
  const api = `/api/host/${encodeURIComponent(inviteCode)}`;

  const [roster, setRoster] = useState<RosterPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tripJoinUrl, setTripJoinUrl] = useState(() => studentAppPath(inviteCode));

  const load = useCallback(async () => {
    setError(null);
    try {
      const data = await hostJson<RosterPayload>(`${api}/roster`);
      setRoster(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load roster");
    } finally {
      setLoading(false);
    }
  }, [api]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    setTripJoinUrl(joinUrl(inviteCode));
  }, [inviteCode]);

  const joinStats = useMemo(() => {
    const students = (roster?.participants ?? []).filter((p) => p.role !== "host");
    const joined = students.filter((p) => p.hasPassword).length;
    return { joined, total: students.length };
  }, [roster?.participants]);

  const groups = graph.groups;

  return (
    <TripSectionShell
      eyebrow="Sharing"
      title="Join links"
      description="Send these links to students. They pick their name from the roster and set a password to join."
    >
      {error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      <TripSoftPanel title="Main trip link">
        <p className="text-sm text-zinc-600">
          Works for anyone on the roster. Share this in your trip info pack or group chat.
          Only links shown here work — old links from other trips will not.
        </p>
        <div className="mt-3">
          <CopyLinkRow url={tripJoinUrl} />
        </div>
        {!loading && joinStats.total > 0 ? (
          <p className="mt-3 text-sm text-zinc-600">
            <span className="font-medium text-zinc-900">
              {joinStats.joined} of {joinStats.total}
            </span>{" "}
            students have joined.
          </p>
        ) : null}
        <p className="mt-2 text-xs text-zinc-500">
          Invite code: <span className="font-mono">{inviteCode}</span>
        </p>
      </TripSoftPanel>

      {groups.length > 0 ? (
        <div className="space-y-4">
          <div>
            <h3 className="text-sm font-semibold text-zinc-900">Group links</h3>
            <p className="mt-1 text-sm text-zinc-500">
              Optional per-group links auto-assign students to a group when they join.
            </p>
          </div>
          {groups.map((g) => (
            <TripSoftPanel key={g.id} title={g.name}>
              {g.isMain ? (
                <p className="mb-3 text-xs text-zinc-500">
                  Main group — students can also use the trip link above.
                </p>
              ) : null}
              <GroupInviteLinks inviteCode={inviteCode} groupId={g.id} groupName={g.name} />
            </TripSoftPanel>
          ))}
        </div>
      ) : null}
    </TripSectionShell>
  );
}
