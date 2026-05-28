"use client";

import { useCallback, useEffect, useState } from "react";

import { hostJson } from "@/components/host/shared/host-fetch";

import { ContactForm } from "./ContactForm";
import { ContactList } from "./ContactList";
import type { HostContact } from "./types";

export function ContactsClient({ inviteCode }: { inviteCode: string }) {
  const api = `/api/host/${encodeURIComponent(inviteCode)}/contacts`;

  const [contacts, setContacts] = useState<HostContact[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const data = await hostJson<{ contacts: HostContact[] }>(api);
    setContacts(data.contacts);
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
    return <p className="text-sm text-zinc-600">Loading contacts…</p>;
  }

  return (
    <main className="flex flex-col gap-5">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">Contacts</h1>
        <p className="text-sm text-zinc-600">
          Key staff and local contacts for students. Publish when ready.
        </p>
      </header>

      {error ? (
        <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-800">{error}</p>
      ) : null}

      <section className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
        Students won&apos;t see changes until you publish. &quot;Hosts only&quot;
        contacts are never shown to students.
      </section>

      <section className="rounded-2xl border border-zinc-200 bg-white p-5">
        <h2 className="text-base font-semibold">All contacts</h2>
        <div className="mt-3">
          <ContactList
            inviteCode={inviteCode}
            contacts={contacts}
            editingId={editingId}
            onEdit={setEditingId}
            onReload={reload}
            onError={setError}
          />
        </div>
        {editingId === null ? (
          <div className="mt-4">
            <ContactForm
              inviteCode={inviteCode}
              onSaved={reload}
              onError={setError}
            />
          </div>
        ) : null}
      </section>
    </main>
  );
}
