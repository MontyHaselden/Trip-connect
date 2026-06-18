"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { hostJson } from "@/components/host/shared/host-fetch";
import type { RosterParticipant } from "@/components/host/roster/types";
import { studentAppPath } from "@/lib/mobile/student-app-paths";

import { TripInput } from "../shared/TripInput";
import { TripSectionShell, TripSoftPanel } from "../shared/TripSectionShell";

type RosterResponse = {
  participants: RosterParticipant[];
};

const ROLE_OPTIONS: Array<{ value: RosterParticipant["role"]; label: string }> = [
  { value: "student", label: "Student" },
  { value: "teacher", label: "Teacher" },
  { value: "helper", label: "Helper" },
];

function roleLabel(role: RosterParticipant["role"]) {
  return ROLE_OPTIONS.find((r) => r.value === role)?.label ?? role;
}

function sortByName(list: RosterParticipant[]) {
  return [...list].sort((a, b) => a.fullName.localeCompare(b.fullName));
}

export function UsersSection(props: { inviteCode: string }) {
  const { inviteCode } = props;
  const api = `/api/host/${encodeURIComponent(inviteCode)}`;
  const inputRef = useRef<HTMLInputElement>(null);
  const roleMenuRef = useRef<HTMLDivElement | null>(null);

  const [participants, setParticipants] = useState<RosterParticipant[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [roleMenuId, setRoleMenuId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await fetch(`${api}/roster`);
      const body = (await res.json().catch(() => ({}))) as RosterResponse & { error?: string };
      if (!res.ok) throw new Error(body.error || "Failed to load users");
      setParticipants(sortByName(body.participants.filter((p) => p.role !== "host")));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load users");
    } finally {
      setLoading(false);
    }
  }, [api]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!roleMenuId) return;

    function closeOnOutside(event: MouseEvent) {
      if (roleMenuRef.current?.contains(event.target as Node)) return;
      setRoleMenuId(null);
    }

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setRoleMenuId(null);
    }

    document.addEventListener("mousedown", closeOnOutside);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("mousedown", closeOnOutside);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [roleMenuId]);

  const joinStats = useMemo(() => {
    const joined = participants.filter((p) => p.hasPassword).length;
    return { joined, total: participants.length };
  }, [participants]);

  function addUser(fullName: string) {
    const trimmed = fullName.trim();
    if (trimmed.length < 2) return;

    const pendingId = `pending-${crypto.randomUUID()}`;
    const optimistic: RosterParticipant = {
      id: pendingId,
      fullName: trimmed,
      phoneNumberE164: "",
      role: "student",
      hasPassword: false,
      roomId: null,
      groupIds: [],
    };

    setName("");
    setError(null);
    setParticipants((prev) => sortByName([...prev, optimistic]));
    inputRef.current?.focus();

    void (async () => {
      try {
        const created = await hostJson<RosterParticipant>(`${api}/participants`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ fullName: trimmed, role: "student" }),
        });
        setParticipants((prev) =>
          sortByName(prev.map((p) => (p.id === pendingId ? created : p))),
        );
      } catch (e) {
        setParticipants((prev) => prev.filter((p) => p.id !== pendingId));
        setError(e instanceof Error ? e.message : "Could not add user");
        inputRef.current?.focus();
      }
    })();
  }

  async function setRole(participantId: string, role: RosterParticipant["role"]) {
    if (participantId.startsWith("pending-")) return;
    setRoleMenuId(null);
    setParticipants((prev) =>
      prev.map((p) => (p.id === participantId ? { ...p, role } : p)),
    );
    try {
      await hostJson(`${api}/participants/${participantId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ role }),
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not update role");
      void load();
    }
  }

  async function removeUser(participantId: string) {
    if (!confirm("Remove this person from the trip?")) return;
    const snapshot = participants;
    setParticipants((prev) => prev.filter((p) => p.id !== participantId));
    if (participantId.startsWith("pending-")) return;
    try {
      await hostJson(`${api}/participants/${participantId}`, { method: "DELETE" });
    } catch (e) {
      setParticipants(snapshot);
      setError(e instanceof Error ? e.message : "Could not remove user");
    }
  }

  const joinLink = studentAppPath(inviteCode);

  return (
    <TripSectionShell
      eyebrow="People"
      title="Users"
      description="Add names here. Students pick themselves on the join link — you can see who hasn't joined yet."
    >
      {error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      <TripSoftPanel>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            addUser(name);
          }}
          className="flex gap-2"
        >
          <TripInput
            ref={inputRef}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Full name — press Enter"
            autoFocus
            className="flex-1"
          />
        </form>
        <p className="mt-2 text-xs text-zinc-500">
          Join link:{" "}
          <a
            href={joinLink}
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-violet-700 hover:underline"
          >
            {joinLink}
          </a>
        </p>
      </TripSoftPanel>

      {participants.length > 0 ? (
        <p className="text-sm text-zinc-600">
          <span className="font-medium text-zinc-900">
            {joinStats.joined} of {joinStats.total}
          </span>{" "}
          joined
        </p>
      ) : null}

      {loading ? (
        <p className="text-sm text-zinc-500">Loading users…</p>
      ) : participants.length === 0 ? (
        <div className="rounded-2xl bg-zinc-50/80 px-5 py-8 text-center text-sm text-zinc-600">
          No users yet. Type a name above and press Enter.
        </div>
      ) : (
        <ul className="space-y-2">
          {participants.map((p) => (
            <li
              key={p.id}
              className={[
                "flex items-center gap-3 rounded-2xl bg-white px-4 py-3 shadow-sm",
                p.id.startsWith("pending-") ? "opacity-70" : "",
              ].join(" ")}
            >
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium text-zinc-900">{p.fullName}</p>
                <div className="mt-1 flex flex-wrap items-center gap-2">
                  <span
                    className={[
                      "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium",
                      p.hasPassword
                        ? "bg-emerald-50 text-emerald-800"
                        : "bg-zinc-100 text-zinc-600",
                    ].join(" ")}
                  >
                    <span
                      className={[
                        "h-1.5 w-1.5 rounded-full",
                        p.hasPassword ? "bg-emerald-500" : "bg-zinc-400",
                      ].join(" ")}
                    />
                    {p.hasPassword ? "Joined" : "Not joined"}
                  </span>

                  <div
                    className="relative"
                    ref={roleMenuId === p.id ? roleMenuRef : undefined}
                  >
                    <button
                      type="button"
                      disabled={p.id.startsWith("pending-")}
                      onClick={() => setRoleMenuId((id) => (id === p.id ? null : p.id))}
                      className="rounded-full bg-zinc-100 px-2.5 py-0.5 text-xs font-medium text-zinc-700 transition hover:bg-zinc-200 disabled:opacity-50"
                    >
                      {roleLabel(p.role)} ▾
                    </button>
                    {roleMenuId === p.id ? (
                      <div className="absolute left-0 top-full z-10 mt-1 min-w-[8rem] rounded-xl border border-zinc-200 bg-white py-1 shadow-lg">
                        {ROLE_OPTIONS.map((opt) => (
                          <button
                            key={opt.value}
                            type="button"
                            onClick={() => void setRole(p.id, opt.value)}
                            className={[
                              "block w-full px-3 py-2 text-left text-sm",
                              p.role === opt.value
                                ? "bg-violet-50 font-medium text-violet-900"
                                : "text-zinc-700 hover:bg-zinc-50",
                            ].join(" ")}
                          >
                            {opt.label}
                          </button>
                        ))}
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => void removeUser(p.id)}
                className="shrink-0 text-sm text-zinc-400 transition hover:text-red-600"
                aria-label={`Remove ${p.fullName}`}
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}
    </TripSectionShell>
  );
}
