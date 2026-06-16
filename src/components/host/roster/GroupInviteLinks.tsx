"use client";

import { useEffect, useState } from "react";

import { hostJson } from "@/components/host/shared/host-fetch";

export function GroupInviteLinks(props: {
  inviteCode: string;
  groupId: string;
  groupName: string;
}) {
  const { inviteCode, groupId, groupName } = props;
  const api = `/api/host/${encodeURIComponent(inviteCode)}/groups/${groupId}/invite-links`;
  const [links, setLinks] = useState<
    Array<{
      id: string;
      inviteCode: string;
      label: string;
      isActive: boolean;
      joinCount: number;
    }>
  >([]);
  const [label, setLabel] = useState(`${groupName} students`);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function reload() {
    const body = await hostJson<{ links: typeof links }>(api);
    setLinks(body.links ?? []);
  }

  useEffect(() => {
    reload().catch(() => setLinks([]));
  }, [api]);

  async function createLink() {
    setBusy(true);
    setError(null);
    try {
      await hostJson(api, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ label: label.trim() || `${groupName} students` }),
      });
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create link");
    } finally {
      setBusy(false);
    }
  }

  async function deactivateLink(linkId: string) {
    setBusy(true);
    setError(null);
    try {
      await hostJson(`${api}/${linkId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ isActive: false }),
      });
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not deactivate link");
    } finally {
      setBusy(false);
    }
  }

  const origin = typeof window !== "undefined" ? window.location.origin : "";

  return (
    <div className="mt-3 space-y-2 rounded-lg border border-dashed border-zinc-300 bg-white p-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
        Group invite links
      </p>
      {links.map((link) => (
        <div key={link.id} className="rounded-lg border border-zinc-200 p-2 text-xs">
          <div className="font-medium text-zinc-900">{link.label}</div>
          <div className="mt-1 break-all font-mono text-zinc-600">
            {origin}/s/{link.inviteCode}
          </div>
          <div className="mt-1 text-zinc-500">
            {link.joinCount} joined · {link.isActive ? "Active" : "Inactive"}
          </div>
          {link.isActive ? (
            <button
              type="button"
              disabled={busy}
              onClick={() => deactivateLink(link.id)}
              className="mt-2 text-xs font-medium text-red-700 disabled:opacity-50"
            >
              Deactivate
            </button>
          ) : null}
        </div>
      ))}
      <div className="flex gap-2">
        <input
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="Link label"
          className="h-9 flex-1 rounded-lg border border-zinc-200 px-2 text-sm"
        />
        <button
          type="button"
          disabled={busy}
          onClick={createLink}
          className="rounded-lg bg-zinc-900 px-3 text-sm font-medium text-white disabled:opacity-50"
        >
          Create link
        </button>
      </div>
      {error ? <p className="text-xs text-red-600">{error}</p> : null}
    </div>
  );
}
