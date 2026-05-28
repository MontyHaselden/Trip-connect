"use client";

import { useState } from "react";

import { hostJson } from "@/components/host/shared/host-fetch";

import type { HostContact } from "./types";

export function ContactForm(props: {
  inviteCode: string;
  contact?: HostContact;
  onSaved: () => void;
  onCancel?: () => void;
  onError: (msg: string) => void;
}) {
  const { inviteCode, contact, onSaved, onCancel, onError } = props;
  const api = `/api/host/${encodeURIComponent(inviteCode)}/contacts`;
  const editing = Boolean(contact);

  const [name, setName] = useState(contact?.name ?? "");
  const [role, setRole] = useState(contact?.role ?? "");
  const [phoneNumber, setPhoneNumber] = useState(contact?.phoneNumber ?? "");
  const [visibility, setVisibility] = useState<HostContact["visibility"]>(
    contact?.visibility ?? "students",
  );
  const [isEmergencyLead, setIsEmergencyLead] = useState(
    contact?.isEmergencyLead ?? false,
  );
  const [saving, setSaving] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const payload = {
      name: name.trim(),
      role: role.trim(),
      phoneNumber: phoneNumber.trim(),
      visibility,
      isEmergencyLead,
    };
    try {
      if (editing && contact) {
        await hostJson(`${api}/${contact.id}`, {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(payload),
        });
      } else {
        await hostJson(api, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(payload),
        });
      }
      onSaved();
    } catch (err) {
      onError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form
      onSubmit={submit}
      className="space-y-3 rounded-xl border border-dashed border-zinc-300 bg-zinc-50 p-4"
    >
      <p className="text-sm font-medium">{editing ? "Edit contact" : "Add contact"}</p>
      <input
        required
        placeholder="Name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        className="h-10 w-full rounded-lg border border-zinc-200 px-3 text-sm"
      />
      <input
        required
        placeholder="Role (e.g. Trip leader)"
        value={role}
        onChange={(e) => setRole(e.target.value)}
        className="h-10 w-full rounded-lg border border-zinc-200 px-3 text-sm"
      />
      <input
        required
        placeholder="Phone number"
        value={phoneNumber}
        onChange={(e) => setPhoneNumber(e.target.value)}
        className="h-10 w-full rounded-lg border border-zinc-200 px-3 text-sm"
      />
      <label className="block text-sm">
        <span className="text-xs font-medium text-zinc-600">Visibility</span>
        <select
          value={visibility}
          onChange={(e) =>
            setVisibility(e.target.value as HostContact["visibility"])
          }
          className="mt-1 h-10 w-full rounded-lg border border-zinc-200 px-3 text-sm"
        >
          <option value="students">Students can see</option>
          <option value="hosts_only">Hosts only</option>
        </select>
      </label>
      <label className="flex items-start gap-2 text-sm">
        <input
          type="checkbox"
          checked={isEmergencyLead}
          onChange={(e) => setIsEmergencyLead(e.target.checked)}
          className="mt-1"
        />
        <span>
          <span className="font-medium">Emergency lead</span>
          <span className="mt-0.5 block text-xs text-zinc-600">
            Shown on the student emergency card. Only one lead per trip.
          </span>
        </span>
      </label>
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={saving}
          className="inline-flex h-10 items-center justify-center rounded-xl bg-zinc-900 px-4 text-sm font-medium text-white disabled:opacity-50"
        >
          {saving ? "Saving…" : editing ? "Update" : "Add"}
        </button>
        {onCancel ? (
          <button
            type="button"
            onClick={onCancel}
            className="inline-flex h-10 items-center justify-center rounded-xl border border-zinc-200 px-4 text-sm"
          >
            Cancel
          </button>
        ) : null}
      </div>
    </form>
  );
}
