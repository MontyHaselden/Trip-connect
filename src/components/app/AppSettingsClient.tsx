"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { clearStudentSessionAndCache } from "@/lib/offline/sync";

type HostMe = {
  canEdit: boolean;
  role: string;
  hostId: string;
  tripId: string;
  inviteCode: string;
  isHostMember?: boolean;
};

export function AppSettingsClient() {
  const router = useRouter();
  const [hostMe, setHostMe] = useState<HostMe | null>(null);
  const [loadingHost, setLoadingHost] = useState(false);

  const inviteCode =
    typeof window !== "undefined"
      ? localStorage.getItem("tc_host_invite_code") ??
        localStorage.getItem("tc_invite_code")
      : null;

  const canEditStored =
    typeof window !== "undefined" && localStorage.getItem("tc_can_edit") === "1";

  const manageBase = inviteCode
    ? `/host/${encodeURIComponent(inviteCode)}/manage`
    : null;

  const joinUrl = useMemo(() => {
    if (typeof window === "undefined" || !inviteCode) return "";
    return `${window.location.origin}/join/${encodeURIComponent(inviteCode)}`;
  }, [inviteCode]);

  useEffect(() => {
    if (!inviteCode) return;
    let cancelled = false;
    async function load() {
      setLoadingHost(true);
      try {
        const res = await fetch(
          `/api/host/${encodeURIComponent(inviteCode!)}/me`,
        );
        if (!res.ok) return;
        const body = (await res.json()) as HostMe;
        if (!cancelled) setHostMe(body);
      } finally {
        if (!cancelled) setLoadingHost(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [inviteCode]);

  const canEdit = hostMe?.canEdit ?? canEditStored;
  const isHostMember = Boolean(hostMe?.isHostMember ?? hostMe);

  async function onSignOut() {
    if (inviteCode) {
      await fetch(`/api/host/${encodeURIComponent(inviteCode)}/logout`, {
        method: "POST",
      }).catch(() => null);
    }
    await clearStudentSessionAndCache();
    router.replace("/");
  }

  const manageLinks = [
    { href: "itinerary", label: "Itinerary" },
    { href: "participants", label: "Participants" },
    { href: "contacts", label: "Contacts" },
    { href: "phrases", label: "Phrases" },
    { href: "publish", label: "Publish" },
    { href: "settings", label: "Trip settings" },
    { href: "team", label: "Team permissions" },
  ] as const;

  return (
    <main className="flex flex-col gap-5 py-4">
      <header className="flex flex-col gap-1">
        <Link
          href="/app/today"
          className="text-sm font-medium text-zinc-600 hover:text-zinc-900"
        >
          ← Back to Today
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
      </header>

      {loadingHost ? (
        <p className="text-sm text-zinc-600">Loading…</p>
      ) : isHostMember || canEditStored ? (
        <>
          {!canEdit ? (
            <section className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
              View-only access — you can browse trip info but cannot make changes.
            </section>
          ) : null}

          <section className="rounded-2xl border border-zinc-200 bg-white p-5">
            <h2 className="text-base font-semibold">Trip management</h2>
            {canEdit && manageBase ? (
              <div className="mt-3 grid grid-cols-2 gap-2">
                {manageLinks.map((link) => (
                  <Link
                    key={link.href}
                    href={`${manageBase}/${link.href}`}
                    className="inline-flex h-11 items-center justify-center rounded-xl border border-zinc-200 bg-zinc-50 px-3 text-sm font-medium text-zinc-900"
                  >
                    {link.label}
                  </Link>
                ))}
              </div>
            ) : manageBase ? (
              <div className="mt-3 flex flex-col gap-2">
                <Link
                  href={`${manageBase}/dashboard`}
                  className="inline-flex h-11 items-center justify-center rounded-xl border border-zinc-200 bg-zinc-50 px-3 text-sm font-medium text-zinc-900"
                >
                  Trip overview
                </Link>
              </div>
            ) : null}
          </section>

          {joinUrl ? (
            <section className="rounded-2xl border border-zinc-200 bg-white p-5">
              <h2 className="text-base font-semibold">Student join link</h2>
              <p className="mt-2 break-all rounded-xl bg-zinc-50 px-3 py-2 font-mono text-xs text-zinc-800">
                {joinUrl}
              </p>
            </section>
          ) : null}
        </>
      ) : (
        <section className="rounded-2xl border border-zinc-200 bg-white p-5">
          <h2 className="text-base font-semibold">My trip</h2>
          <p className="mt-2 text-sm text-zinc-600">
            You joined as a student. Update your details from the My Trip tab.
          </p>
          {joinUrl ? (
            <p className="mt-3 break-all rounded-xl bg-zinc-50 px-3 py-2 font-mono text-xs text-zinc-800">
              Invite: {joinUrl}
            </p>
          ) : null}
        </section>
      )}

      <section className="rounded-2xl border border-zinc-200 bg-white p-5">
        <h2 className="text-base font-semibold">Account</h2>
        <button
          type="button"
          onClick={onSignOut}
          className="mt-3 inline-flex h-11 w-full items-center justify-center rounded-xl border border-zinc-200 bg-white px-4 text-sm font-medium text-zinc-900"
        >
          Sign out
        </button>
        <Link
          href="/host"
          className="mt-2 inline-flex h-11 w-full items-center justify-center rounded-xl border border-zinc-200 bg-zinc-50 px-4 text-sm font-medium text-zinc-900"
        >
          Host portal
        </Link>
      </section>
    </main>
  );
}
