"use client";

import { useState } from "react";

import { StudentBottomSheet } from "@/components/student/StudentBottomSheet";
import { formatParticipantRole } from "@/lib/student/my-trip-summary";

export function MyDetailsSheet(props: {
  open: boolean;
  onClose: () => void;
  fullName: string;
  phoneNumberE164: string;
  role: string;
  participantId: string;
}) {
  const { open, onClose, fullName, phoneNumberE164, role, participantId } = props;
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

  function handleClose() {
    setPhone(phoneNumberE164);
    setEditing(false);
    setError(null);
    onClose();
  }

  return (
    <StudentBottomSheet open={open} onClose={handleClose} title="My details">
      <div className="space-y-4 pb-2 text-sm">
        <div>
          <div className="text-xs font-medium text-[var(--student-text-muted)]">Name</div>
          <div className="mt-1 font-semibold text-[var(--student-text)]">{fullName}</div>
        </div>
        <div>
          <div className="text-xs font-medium text-[var(--student-text-muted)]">Phone</div>
          {editing ? (
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="mt-1 h-11 w-full rounded-xl border border-[var(--student-line)] bg-[var(--student-surface)] px-3 text-sm"
            />
          ) : (
            <div className="mt-1 font-semibold text-[var(--student-text)]">{phone}</div>
          )}
        </div>
        <div>
          <div className="text-xs font-medium text-[var(--student-text-muted)]">Role</div>
          <div className="mt-1 font-semibold text-[var(--student-text)]">
            {formatParticipantRole(role)}
          </div>
        </div>

        {error ? <p className="text-xs text-red-600">{error}</p> : null}

        {editing ? (
          <div className="flex gap-2 pt-1">
            <button
              type="button"
              disabled={saving}
              onClick={savePhone}
              className="student-btn-primary inline-flex h-11 flex-1 items-center justify-center text-sm disabled:opacity-50"
            >
              {saving ? "Saving…" : "Save"}
            </button>
            <button
              type="button"
              onClick={() => {
                setPhone(phoneNumberE164);
                setEditing(false);
              }}
              className="student-btn-secondary inline-flex h-11 items-center justify-center px-4 text-sm"
            >
              Cancel
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="student-btn-secondary inline-flex h-11 w-full items-center justify-center text-sm"
          >
            Edit my phone number
          </button>
        )}
      </div>
    </StudentBottomSheet>
  );
}
