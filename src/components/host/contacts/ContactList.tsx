"use client";

import { hostJson } from "@/components/host/shared/host-fetch";

import { ContactForm } from "./ContactForm";
import type { HostContact } from "./types";

export function ContactList(props: {
  inviteCode: string;
  contacts: HostContact[];
  editingId: string | null;
  onEdit: (id: string | null) => void;
  onReload: () => void;
  onError: (msg: string) => void;
}) {
  const { inviteCode, contacts, editingId, onEdit, onReload, onError } = props;
  const api = `/api/host/${encodeURIComponent(inviteCode)}/contacts`;
  const sorted = [...contacts].sort((a, b) => a.sortOrder - b.sortOrder);

  async function move(contact: HostContact, dir: -1 | 1) {
    const idx = sorted.findIndex((c) => c.id === contact.id);
    const swap = sorted[idx + dir];
    if (!swap) return;
    try {
      await Promise.all([
        hostJson(`${api}/${contact.id}`, {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ sortOrder: swap.sortOrder }),
        }),
        hostJson(`${api}/${swap.id}`, {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ sortOrder: contact.sortOrder }),
        }),
      ]);
      onReload();
    } catch (err) {
      onError(err instanceof Error ? err.message : "Reorder failed");
    }
  }

  async function remove(id: string) {
    if (!confirm("Delete this contact?")) return;
    try {
      await hostJson(`${api}/${id}`, { method: "DELETE" });
      onReload();
    } catch (err) {
      onError(err instanceof Error ? err.message : "Delete failed");
    }
  }

  if (!sorted.length) {
    return (
      <p className="text-sm text-zinc-600">
        No contacts yet. Add teachers, hotel staff, or local guides below.
      </p>
    );
  }

  return (
    <ul className="flex flex-col gap-2">
      {sorted.map((c, idx) =>
        editingId === c.id ? (
          <li key={c.id}>
            <ContactForm
              inviteCode={inviteCode}
              contact={c}
              onSaved={() => {
                onEdit(null);
                onReload();
              }}
              onCancel={() => onEdit(null)}
              onError={onError}
            />
          </li>
        ) : (
          <li
            key={c.id}
            className="rounded-xl border border-zinc-200 bg-white px-4 py-3 text-sm"
          >
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">{c.name}</span>
                  {c.isEmergencyLead ? (
                    <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-800">
                      Emergency lead
                    </span>
                  ) : null}
                  <span
                    className={[
                      "rounded-full px-2 py-0.5 text-xs font-medium",
                      c.visibility === "students"
                        ? "bg-emerald-100 text-emerald-900"
                        : "bg-zinc-100 text-zinc-700",
                    ].join(" ")}
                  >
                    {c.visibility === "students" ? "Students" : "Hosts only"}
                  </span>
                </div>
                <p className="text-zinc-600">{c.role}</p>
                <p className="mt-1 font-mono text-xs">{c.phoneNumber}</p>
              </div>
              <div className="flex shrink-0 flex-col gap-1">
                <button
                  type="button"
                  disabled={idx === 0}
                  onClick={() => move(c, -1)}
                  className="text-xs disabled:opacity-30"
                >
                  ↑
                </button>
                <button
                  type="button"
                  disabled={idx === sorted.length - 1}
                  onClick={() => move(c, 1)}
                  className="text-xs disabled:opacity-30"
                >
                  ↓
                </button>
              </div>
            </div>
            <div className="mt-2 flex gap-2">
              <button
                type="button"
                onClick={() => onEdit(c.id)}
                className="text-xs font-medium"
              >
                Edit
              </button>
              <button
                type="button"
                onClick={() => remove(c.id)}
                className="text-xs font-medium text-red-700"
              >
                Delete
              </button>
            </div>
          </li>
        ),
      )}
    </ul>
  );
}
