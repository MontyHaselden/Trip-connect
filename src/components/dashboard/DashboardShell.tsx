"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import type { TripLifecycleStatus } from "@/lib/host/trip-lifecycle";

import { HostMobileLinkCard } from "./HostMobileLinkCard";
import { TripStatusBadge } from "./TripStatusBadge";

export function DashboardShell(props: {
  children: React.ReactNode;
  tripId?: string;
  tripName?: string;
  tripStatus?: TripLifecycleStatus;
  tripStatusLabel?: string;
  continuePath?: string;
  wizardInProgress?: boolean;
}) {
  const {
    children,
    tripId,
    tripName,
    tripStatus,
    tripStatusLabel,
    continuePath,
    wizardInProgress,
  } = props;
  const pathname = usePathname();
  const isSetupRoute = Boolean(tripId && pathname.includes(`/trips/${tripId}/setup`));

  const setupHref = tripId ? `/dashboard/trips/${tripId}/setup` : "/dashboard";
  const builderHref = tripId ? `/dashboard/trips/${tripId}/builder` : "/dashboard";
  const isBuilding = tripStatus === "building" || wizardInProgress;
  const primaryHref = isBuilding ? setupHref : builderHref;

  const tripNav = tripId
    ? [
        {
          href: continuePath ?? primaryHref,
          label: isBuilding ? "Continue setup" : "Builder",
        },
        ...(isBuilding
          ? []
          : [{ href: setupHref, label: "Setup" }]),
        { href: `/dashboard/trips/${tripId}/participants`, label: "Participants" },
        { href: `/dashboard/trips/${tripId}/locations`, label: "Locations" },
        { href: `/dashboard/trips/${tripId}/photos`, label: "Photos" },
        { href: `/dashboard/trips/${tripId}/viewers`, label: "Viewers" },
        { href: `/dashboard/trips/${tripId}/settings`, label: "Settings" },
      ]
    : [];

  return (
    <div className="flex h-dvh min-h-0 bg-zinc-50">
      <aside className="hidden w-56 shrink-0 border-r border-zinc-200 bg-white p-4 lg:block">
        <Link href="/dashboard" className="text-lg font-semibold">
          Itinerary Live
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
            <div className="px-3">
              <p className="truncate text-xs font-semibold uppercase tracking-wide text-zinc-400">
                {tripName ?? "Trip"}
              </p>
              {tripStatus && tripStatusLabel ? (
                <div className="mt-2">
                  <TripStatusBadge status={tripStatus} label={tripStatusLabel} />
                </div>
              ) : null}
            </div>
            <nav className="mt-2 space-y-1">
              {tripNav.map((item) => {
                const baseHref = item.href.split("?")[0]!;
                const isActive =
                  item.label === "Continue setup"
                    ? pathname.includes(`${tripId}/setup`)
                    : pathname.startsWith(baseHref);

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={[
                      "block rounded-lg px-3 py-2 text-sm",
                      isActive
                        ? "bg-zinc-900 font-medium text-white"
                        : "text-zinc-600 hover:bg-zinc-50",
                    ].join(" ")}
                  >
                    {item.label}
                  </Link>
                );
              })}
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
      <main className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        {tripId && !isSetupRoute ? (
          <div className="shrink-0 border-b border-sky-100 bg-sky-50/40 px-5 py-4 lg:hidden">
            <HostMobileLinkCard tripId={tripId} />
          </div>
        ) : null}
        <div className="min-h-0 flex-1 overflow-hidden">{children}</div>
        {tripId && !isSetupRoute ? (
          <div className="hidden shrink-0 border-t border-zinc-100 px-5 py-6 lg:block">
            <div className="mx-auto max-w-5xl">
              <HostMobileLinkCard tripId={tripId} />
            </div>
          </div>
        ) : null}
      </main>
    </div>
  );
}
