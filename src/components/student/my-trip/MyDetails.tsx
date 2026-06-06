"use client";

import { useState } from "react";

export function MyDetails(props: {
  fullName: string;
  phoneNumberE164: string;
  role: string;
  participantId: string;
}) {
  const { fullName, phoneNumberE164, role, participantId } = props;
  const [editing, setEditing] = useState(false);
  const [phone, setPhone] = useState(phoneNumberE164);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function savePhone() {
    setSaving(true);
    setError(null);
    try {
      const token = localStorage.getItem("tc_access_token");
      const res = await fetch(`/api/participants/${participantId}/phone`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          ...(token ? { authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ phoneNumberE164: phone.trim() }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error ?? "Update failed");
      setEditing(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Update failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="rounded-2xl border border-zinc-200 bg-white p-5">
      <h2 className="text-base font-semibold">My details</h2>
      <div className="mt-3 space-y-2 text-sm">
        <div>
          <div className="text-xs text-zinc-500">Name</div>
          <div className="font-medium text-zinc-900">{fullName}</div>
        </div>
        <div>
          <div className="text-xs text-zinc-500">Phone</div>
          {editing ? (
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="mt-1 h-10 w-full rounded-lg border border-zinc-200 px-3 text-sm"
            />
          ) : (
            <div className="font-medium text-zinc-900">{phone}</div>
          )}
        </div>
        <div>
          <div className="text-xs text-zinc-500">Role</div>
          <div className="font-medium text-zinc-900">{role}</div>
        </div>
      </div>
      {error ? <p className="mt-2 text-xs text-red-600">{error}</p> : null}
      {editing ? (
        <div className="mt-4 flex gap-2">
          <button
            type="button"
            disabled={saving}
            onClick={savePhone}
            className="inline-flex h-10 flex-1 items-center justify-center rounded-xl bg-zinc-900 text-sm font-medium text-white disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save"}
          </button>
          <button
            type="button"
            onClick={() => {
              setPhone(phoneNumberE164);
              setEditing(false);
            }}
            className="inline-flex h-10 items-center justify-center rounded-xl border border-zinc-200 px-4 text-sm"
          >
            Cancel
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="mt-4 inline-flex h-10 w-full items-center justify-center rounded-xl border border-zinc-200 bg-white text-sm font-medium text-zinc-900"
        >
          Edit my phone number
        </button>
      )}
    </section>
  );
}
