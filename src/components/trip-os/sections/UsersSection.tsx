"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { hostJson } from "@/components/host/shared/host-fetch";
import type { RosterParticipant, RosterPayload } from "@/components/host/roster/types";
import { TripInput } from "../shared/TripInput";
import { TripSectionShell, TripSoftPanel } from "../shared/TripSectionShell";

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

function InlineEditableName(props: {
  value: string;
  disabled?: boolean;
  onSave: (name: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(props.value);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setDraft(props.value);
  }, [props.value]);

  useEffect(() => {
    if (editing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [editing]);

  function cancel() {
    setDraft(props.value);
    setEditing(false);
  }

  function commit() {
    const trimmed = draft.trim();
    setEditing(false);
    if (trimmed.length >= 2 && trimmed !== props.value) {
      props.onSave(trimmed);
    } else {
      setDraft(props.value);
    }
  }

  if (editing && !props.disabled) {
    return (
      <input
        ref={inputRef}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            commit();
          }
          if (e.key === "Escape") {
            e.preventDefault();
            cancel();
          }
        }}
        className="min-w-[8rem] max-w-full rounded-lg border border-violet-300 bg-white px-2 py-0.5 text-sm font-medium text-zinc-900 outline-none ring-2 ring-violet-500/20"
      />
    );
  }

  return (
    <button
      type="button"
      disabled={props.disabled}
      onClick={() => {
        if (!props.disabled) setEditing(true);
      }}
      className="truncate text-left text-sm font-medium text-zinc-900 hover:text-violet-700 disabled:opacity-70"
      title="Click to edit name"
    >
      {props.value}
    </button>
  );
}

export function UsersSection(props: { inviteCode: string; onRosterChanged?: () => void }) {
  const { inviteCode, onRosterChanged } = props;
  const api = `/api/host/${encodeURIComponent(inviteCode)}`;
  const inputRef = useRef<HTMLInputElement>(null);
  const roleMenuRef = useRef<HTMLDivElement | null>(null);
  const rosterChangedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const notifyRosterChanged = useCallback(() => {
    if (!onRosterChanged) return;
    if (rosterChangedTimerRef.current) clearTimeout(rosterChangedTimerRef.current);
    rosterChangedTimerRef.current = setTimeout(() => {
      onRosterChanged();
    }, 300);
  }, [onRosterChanged]);

  const [roster, setRoster] = useState<RosterPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [bulkText, setBulkText] = useState("");
  const [showBulk, setShowBulk] = useState(false);
  const [groupFilter, setGroupFilter] = useState<string>("");
  const [roleMenuId, setRoleMenuId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const participants = useMemo(
    () => sortByName((roster?.participants ?? []).filter((p) => p.role !== "host")),
    [roster?.participants],
  );

  const load = useCallback(async () => {
    setError(null);
    try {
      const data = await hostJson<RosterPayload>(`${api}/roster`);
      setRoster(data);
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
    return () => {
      if (rosterChangedTimerRef.current) clearTimeout(rosterChangedTimerRef.current);
    };
  }, []);

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

  const filtered = useMemo(() => {
    if (!groupFilter) return participants;
    return participants.filter((p) => p.groupIds.includes(groupFilter));
  }, [participants, groupFilter]);

  const joinStats = useMemo(() => {
    const joined = participants.filter((p) => p.hasPassword).length;
    return { joined, total: participants.length };
  }, [participants]);

  const groupNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const g of roster?.groups ?? []) map.set(g.id, g.name);
    return map;
  }, [roster?.groups]);

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
      inCostSplit: true,
      roomId: null,
      groupIds: [],
    };

    setName("");
    setError(null);
    setRoster((prev) =>
      prev
        ? { ...prev, participants: sortByName([...prev.participants, optimistic]) }
        : prev,
    );
    inputRef.current?.focus();

    void (async () => {
      try {
        const created = await hostJson<RosterParticipant>(`${api}/participants`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ fullName: trimmed, role: "student" }),
        });
        setRoster((prev) =>
          prev
            ? {
                ...prev,
                participants: sortByName(
                  prev.participants.map((p) => (p.id === pendingId ? created : p)),
                ),
              }
            : prev,
        );
        notifyRosterChanged();
      } catch (e) {
        setRoster((prev) =>
          prev
            ? { ...prev, participants: prev.participants.filter((p) => p.id !== pendingId) }
            : prev,
        );
        setError(e instanceof Error ? e.message : "Could not add user");
        inputRef.current?.focus();
      }
    })();
  }

  async function bulkAdd() {
    const names = bulkText
      .split("\n")
      .map((n) => n.trim())
      .filter((n) => n.length >= 2);
    if (!names.length) return;
    setShowBulk(false);
    setBulkText("");
    for (const n of names) addUser(n);
  }

  async function patchParticipant(
    participantId: string,
    patch: Partial<
      Pick<RosterParticipant, "fullName" | "role" | "roomId" | "groupIds" | "inCostSplit">
    >,
  ) {
    if (participantId.startsWith("pending-")) return;
    setRoster((prev) => {
      if (!prev) return prev;
      const participants = sortByName(
        prev.participants.map((p) => (p.id === participantId ? { ...p, ...patch } : p)),
      );
      return { ...prev, participants };
    });
    try {
      const updated = await hostJson<RosterParticipant>(`${api}/participants/${participantId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(patch),
      });
      setRoster((prev) =>
        prev
          ? {
              ...prev,
              participants: sortByName(
                prev.participants.map((p) => (p.id === participantId ? updated : p)),
              ),
            }
          : prev,
      );
      notifyRosterChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not update user");
      void load();
    }
  }

  async function renameUser(participantId: string, fullName: string) {
    await patchParticipant(participantId, { fullName });
  }

  async function setRole(participantId: string, role: RosterParticipant["role"]) {
    setRoleMenuId(null);
    await patchParticipant(participantId, { role });
  }

  async function toggleGroup(participantId: string, groupId: string) {
    const p = participants.find((x) => x.id === participantId);
    if (!p) return;
    const groupIds = p.groupIds.includes(groupId)
      ? p.groupIds.filter((id) => id !== groupId)
      : [...p.groupIds, groupId];
    await patchParticipant(participantId, { groupIds });
  }

  async function removeUser(participantId: string) {
    if (!confirm("Remove this person from the trip?")) return;
    const snapshot = roster;
    setRoster((prev) =>
      prev
        ? { ...prev, participants: prev.participants.filter((p) => p.id !== participantId) }
        : prev,
    );
    if (participantId.startsWith("pending-")) return;
    try {
      await hostJson(`${api}/participants/${participantId}`, { method: "DELETE" });
      notifyRosterChanged();
    } catch (e) {
      setRoster(snapshot);
      setError(e instanceof Error ? e.message : "Could not remove user");
    }
  }

  return (
    <TripSectionShell
      eyebrow="People"
      title="Users"
      description="Roster drives cost columns — assign groups, rooms, and who is included in the cost split."
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
          <button
            type="button"
            onClick={() => setShowBulk((v) => !v)}
            className="shrink-0 rounded-xl bg-zinc-100 px-3 py-2 text-xs font-medium text-zinc-700 hover:bg-zinc-200"
          >
            Bulk add
          </button>
        </form>
        {showBulk ? (
          <div className="mt-3 space-y-2">
            <textarea
              value={bulkText}
              onChange={(e) => setBulkText(e.target.value)}
              placeholder="One name per line"
              rows={4}
              className="w-full rounded-xl border border-zinc-200 px-3 py-2 text-sm"
            />
            <button
              type="button"
              onClick={() => void bulkAdd()}
              className="rounded-xl bg-violet-600 px-4 py-2 text-xs font-medium text-white hover:bg-violet-700"
            >
              Import names
            </button>
          </div>
        ) : null}
      </TripSoftPanel>

      <div className="flex flex-wrap items-center gap-3">
        {participants.length > 0 ? (
          <p className="text-sm text-zinc-600">
            <span className="font-medium text-zinc-900">
              {joinStats.joined} of {joinStats.total}
            </span>{" "}
            joined
          </p>
        ) : null}
        {(roster?.groups.length ?? 0) > 0 ? (
          <select
            value={groupFilter}
            onChange={(e) => setGroupFilter(e.target.value)}
            className="rounded-lg border border-zinc-200 px-2 py-1 text-xs"
          >
            <option value="">All groups</option>
            {roster?.groups.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))}
          </select>
        ) : null}
      </div>

      {loading ? (
        <p className="text-sm text-zinc-500">Loading users…</p>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl bg-zinc-50/80 px-5 py-8 text-center text-sm text-zinc-600">
          No users yet. Type a name above and press Enter.
        </div>
      ) : (
        <ul className="space-y-2">
          {filtered.map((p) => (
            <li
              key={p.id}
              className={[
                "rounded-2xl bg-white px-4 py-3 shadow-sm",
                p.id.startsWith("pending-") ? "opacity-70" : "",
              ].join(" ")}
            >
              <div className="flex items-start gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <InlineEditableName
                      value={p.fullName}
                      disabled={p.id.startsWith("pending-")}
                      onSave={(fullName) => void renameUser(p.id, fullName)}
                    />
                    {p.groupIds.map((gid) => (
                      <span
                        key={gid}
                        className="rounded-full bg-violet-50 px-2 py-0.5 text-[10px] font-medium text-violet-800"
                      >
                        {groupNameById.get(gid) ?? "Group"}
                      </span>
                    ))}
                  </div>
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

                    <label className="inline-flex items-center gap-1.5 text-xs text-zinc-600">
                      <input
                        type="checkbox"
                        checked={p.inCostSplit}
                        disabled={p.id.startsWith("pending-")}
                        onChange={(e) =>
                          void patchParticipant(p.id, { inCostSplit: e.target.checked })
                        }
                        className="rounded border-zinc-300"
                      />
                      In cost split
                    </label>

                    <button
                      type="button"
                      onClick={() => setExpandedId((id) => (id === p.id ? null : p.id))}
                      className="text-xs text-violet-700 hover:underline"
                    >
                      {expandedId === p.id ? "Hide details" : "Groups & room"}
                    </button>
                  </div>

                  {expandedId === p.id ? (
                    <div className="mt-3 space-y-3 rounded-xl bg-zinc-50 p-3">
                      {(roster?.groups.length ?? 0) > 0 ? (
                        <div>
                          <p className="text-xs font-medium text-zinc-600">Groups</p>
                          <div className="mt-1 flex flex-wrap gap-1.5">
                            {roster?.groups.map((g) => {
                              const active = p.groupIds.includes(g.id);
                              return (
                                <button
                                  key={g.id}
                                  type="button"
                                  disabled={p.id.startsWith("pending-")}
                                  onClick={() => void toggleGroup(p.id, g.id)}
                                  className={[
                                    "rounded-full px-2.5 py-1 text-xs font-medium transition",
                                    active
                                      ? "bg-violet-600 text-white"
                                      : "bg-white text-zinc-600 ring-1 ring-zinc-200 hover:bg-zinc-100",
                                  ].join(" ")}
                                >
                                  {g.name}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      ) : (
                        <p className="text-xs text-zinc-500">No groups yet — create them in the calendar.</p>
                      )}
                      {(roster?.rooms.length ?? 0) > 0 ? (
                        <label className="block text-xs">
                          <span className="font-medium text-zinc-600">Room</span>
                          <select
                            value={p.roomId ?? ""}
                            disabled={p.id.startsWith("pending-")}
                            onChange={(e) =>
                              void patchParticipant(p.id, {
                                roomId: e.target.value || null,
                              })
                            }
                            className="mt-1 block w-full rounded-lg border border-zinc-200 px-2 py-1.5 text-sm"
                          >
                            <option value="">No room</option>
                            {roster?.rooms.map((r) => (
                              <option key={r.id} value={r.id}>
                                {r.roomName}
                              </option>
                            ))}
                          </select>
                        </label>
                      ) : null}
                    </div>
                  ) : null}
                </div>

                <button
                  type="button"
                  onClick={() => void removeUser(p.id)}
                  className="shrink-0 text-sm text-zinc-400 transition hover:text-red-600"
                  aria-label={`Remove ${p.fullName}`}
                >
                  Remove
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </TripSectionShell>
  );
}
