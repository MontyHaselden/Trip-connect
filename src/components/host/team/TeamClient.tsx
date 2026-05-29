"use client";

import { useEffect, useState } from "react";

type Member = {
  hostId: string;
  canEdit: boolean;
  email: string;
  fullName: string;
  role: string;
  acceptedAt: string | null;
};

type PendingInvite = {
  id: string;
  invitedEmail: string;
  canEdit: boolean;
  invitedAt: string;
};

export function TeamClient(props: { inviteCode: string }) {
  const { inviteCode } = props;
  const api = `/api/host/${encodeURIComponent(inviteCode)}/team`;

  const [members, setMembers] = useState<Member[]>([]);
  const [pending, setPending] = useState<PendingInvite[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [canEdit, setCanEdit] = useState(true);
  const [busy, setBusy] = useState(false);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(api);
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body?.error || "Failed to load team");
      setMembers(body.members ?? []);
      setPending(body.pending ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load team");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inviteCode]);

  async function onInvite(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(api, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, canEdit }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body?.error || "Invite failed");
      setEmail("");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Invite failed");
    } finally {
      setBusy(false);
    }
  }

  async function toggleCanEdit(hostId: string, next: boolean) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`${api}/${encodeURIComponent(hostId)}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ canEdit: next }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body?.error || "Update failed");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Update failed");
    } finally {
      setBusy(false);
    }
  }

  async function removeMember(hostId: string) {
    if (!window.confirm("Remove this team member from the trip?")) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`${api}/${encodeURIComponent(hostId)}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ remove: true }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body?.error || "Remove failed");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Remove failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="flex flex-col gap-5">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">Team</h1>
        <p className="text-sm text-zinc-600">
          Invite co-teachers by email. Toggle edit access per person.
        </p>
      </header>

      {error ? (
        <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-800">
          {error}
        </p>
      ) : null}

      <section className="rounded-2xl border border-zinc-200 bg-white p-5">
        <h2 className="text-base font-semibold">Invite by email</h2>
        <form onSubmit={onInvite} className="mt-3 flex flex-col gap-3">
          <label className="block">
            <span className="text-sm font-medium text-zinc-900">Email</span>
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              type="email"
              required
              className="mt-2 h-11 w-full rounded-xl border border-zinc-200 bg-white px-3 text-sm outline-none focus:border-zinc-400"
              placeholder="teacher@school.edu"
            />
          </label>
          <label className="flex items-center gap-2 text-sm text-zinc-800">
            <input
              type="checkbox"
              checked={canEdit}
              onChange={(e) => setCanEdit(e.target.checked)}
            />
            Can edit trip
          </label>
          <button
            type="submit"
            disabled={busy}
            className="inline-flex h-11 items-center justify-center rounded-xl bg-zinc-900 px-4 text-sm font-medium text-white disabled:opacity-50"
          >
            {busy ? "Sending…" : "Send invite"}
          </button>
          <p className="text-xs text-zinc-600">
            If they don&apos;t have an account yet, they&apos;ll be added when
            they sign up with this email.
          </p>
        </form>
      </section>

      <section className="rounded-2xl border border-zinc-200 bg-white p-5">
        <h2 className="text-base font-semibold">Members</h2>
        {loading ? (
          <p className="mt-2 text-sm text-zinc-600">Loading…</p>
        ) : members.length ? (
          <ul className="mt-3 flex flex-col gap-3">
            {members.map((m) => (
              <li
                key={m.hostId}
                className="rounded-xl border border-zinc-200 px-4 py-3"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium text-zinc-900">
                      {m.fullName}
                    </p>
                    <p className="text-xs text-zinc-600">{m.email}</p>
                    <p className="mt-1 text-xs text-zinc-500 capitalize">
                      {m.role} · {m.canEdit ? "Can edit" : "View only"}
                    </p>
                  </div>
                  <div className="flex flex-col gap-2">
                    <label className="flex items-center gap-2 text-xs text-zinc-700">
                      <input
                        type="checkbox"
                        checked={m.canEdit}
                        disabled={busy}
                        onChange={(e) =>
                          toggleCanEdit(m.hostId, e.target.checked)
                        }
                      />
                      Can edit
                    </label>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => removeMember(m.hostId)}
                      className="text-xs font-medium text-red-700"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-sm text-zinc-600">No members yet.</p>
        )}
      </section>

      {pending.length ? (
        <section className="rounded-2xl border border-zinc-200 bg-white p-5">
          <h2 className="text-base font-semibold">Pending invites</h2>
          <ul className="mt-3 flex flex-col gap-2 text-sm text-zinc-800">
            {pending.map((p) => (
              <li key={p.id} className="rounded-xl bg-zinc-50 px-3 py-2">
                {p.invitedEmail} · {p.canEdit ? "Can edit" : "View only"}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </main>
  );
}
