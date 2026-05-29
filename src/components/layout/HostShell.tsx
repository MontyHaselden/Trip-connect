"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

function ReadOnlyBanner() {
  return (
    <section className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
      View-only — you can browse but cannot edit this trip.
    </section>
  );
}

export function HostShell(props: {
  inviteCode: string;
  children: React.ReactNode;
}) {
  const { inviteCode, children } = props;
  const pathname = usePathname();
  const router = useRouter();
  const [canEdit, setCanEdit] = useState<boolean | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch(
          `/api/host/${encodeURIComponent(inviteCode)}/me`,
        );
        if (!res.ok) return;
        const body = (await res.json()) as { canEdit: boolean };
        if (!cancelled) setCanEdit(body.canEdit);
      } catch {
        // ignore
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [inviteCode]);

  async function onLogout() {
    await fetch(`/api/host/${encodeURIComponent(inviteCode)}/logout`, {
      method: "POST",
    });
    router.replace("/host");
  }

  const pageTitle = (() => {
    const tail = pathname.split("/").pop() ?? "";
    if (tail === "manage") return "Manage trip";
    return tail.charAt(0).toUpperCase() + tail.slice(1);
  })();

  return (
    <div className="min-h-dvh bg-zinc-50 text-zinc-900">
      <header className="border-b border-zinc-200 bg-white">
        <div className="mx-auto flex w-full max-w-3xl items-center justify-between gap-3 px-5 py-4">
          <div className="min-w-0">
            <Link
              href="/app/today"
              className="text-sm font-medium text-zinc-600 hover:text-zinc-900"
            >
              ← Back to app
            </Link>
            <p className="truncate text-base font-semibold">{pageTitle}</p>
          </div>
          <button
            type="button"
            onClick={onLogout}
            className="shrink-0 rounded-lg px-3 py-2 text-sm font-medium text-zinc-600 hover:bg-zinc-100"
          >
            Log out
          </button>
        </div>
      </header>
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-4 px-5 py-6">
        {canEdit === false ? <ReadOnlyBanner /> : null}
        {children}
      </div>
    </div>
  );
}
