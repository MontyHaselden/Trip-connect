"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { HostMobileLinkCard } from "./HostMobileLinkCard";

export function DashboardShell(props: {
  children: React.ReactNode;
  tripId?: string;
  tripName?: string;
}) {
  const { children, tripId, tripName } = props;
  const pathname = usePathname();

  const tripNav = tripId
    ? [
        { href: `/dashboard/trips/${tripId}/builder`, label: "Builder" },
        { href: `/dashboard/trips/${tripId}/participants`, label: "Participants" },
        { href: `/dashboard/trips/${tripId}/accommodation`, label: "Accommodation" },
        { href: `/dashboard/trips/${tripId}/photos`, label: "Photos" },
        { href: `/dashboard/trips/${tripId}/viewers`, label: "Viewers" },
        { href: `/dashboard/trips/${tripId}/settings`, label: "Settings" },
      ]
    : [];

  return (
    <div className="flex min-h-dvh bg-zinc-50">
      <aside className="hidden w-56 shrink-0 border-r border-zinc-200 bg-white p-4 lg:block">
        <Link href="/dashboard" className="text-lg font-semibold">
          Trip Connect
        </Link>
        <nav className="mt-8 space-y-1">
          <Link
            href="/dashboard"
            className={[
              "block rounded-lg px-3 py-2 text-sm font-medium",
              pathname === "/dashboard" ? "bg-zinc-100" : "text-zinc-600 hover:bg-zinc-50",
            ].join(" ")}
          >
            My trips
          </Link>
          <Link
            href="/dashboard/trips/new"
            className="block rounded-lg px-3 py-2 text-sm font-medium text-zinc-600 hover:bg-zinc-50"
          >
            New trip
          </Link>
        </nav>
        {tripId ? (
          <div className="mt-8 border-t border-zinc-100 pt-4">
            <p className="truncate px-3 text-xs font-semibold uppercase text-zinc-400">
              {tripName ?? "Trip"}
            </p>
            <nav className="mt-2 space-y-1">
              {tripNav.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={[
                    "block rounded-lg px-3 py-2 text-sm",
                    pathname.startsWith(item.href)
                      ? "bg-zinc-900 font-medium text-white"
                      : "text-zinc-600 hover:bg-zinc-50",
                  ].join(" ")}
                >
                  {item.label}
                </Link>
              ))}
            </nav>
          </div>
        ) : null}
        <div className="mt-8 border-t border-zinc-100 pt-4">
          <button
            type="button"
            onClick={async () => {
              await fetch("/api/auth/logout", { method: "POST" }).catch(() => null);
              window.location.href = "/login";
            }}
            className="block w-full rounded-lg px-3 py-2 text-left text-sm text-zinc-600 hover:bg-zinc-50"
          >
            Log out
          </button>
        </div>
      </aside>
      <main className="min-w-0 flex-1">
        {tripId ? (
          <div className="border-b border-sky-100 bg-sky-50/40 px-5 py-4 lg:hidden">
            <HostMobileLinkCard tripId={tripId} />
          </div>
        ) : null}
        {children}
        {tripId ? (
          <div className="hidden border-t border-zinc-100 px-5 py-6 lg:block">
            <div className="mx-auto max-w-5xl">
              <HostMobileLinkCard tripId={tripId} />
            </div>
          </div>
        ) : null}
      </main>
    </div>
  );
}
