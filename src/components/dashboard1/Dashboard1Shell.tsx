"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import type { TripLifecycleStatus } from "@/lib/host/trip-lifecycle";
import { dashboardSetupPath } from "@/lib/dashboard1/paths";

import { HostMobileLinkCard } from "@/components/dashboard/HostMobileLinkCard";
import { TripStatusBadge } from "@/components/dashboard/TripStatusBadge";

export function Dashboard1Shell(props: {
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

  const setupHref = tripId ? dashboardSetupPath(tripId) : "/dashboard";
  const builderHref = tripId ? `/dashboard/trips/${tripId}/builder` : "/dashboard";
  const isBuilding = tripStatus === "building" || wizardInProgress;
  const primaryHref = isBuilding ? setupHref : builderHref;

  const tripNav = tripId
    ? [
        {
          href: continuePath ?? primaryHref,
          label: isBuilding ? "Continue setup" : "Builder",
        },
        ...(isBuilding ? [] : [{ href: setupHref, label: "Setup" }]),
        { href: `/dashboard/trips/${tripId}/participants`, label: "Participants" },
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
                Trip
              </p>
              <p className="mt-1 truncate text-sm font-medium">{tripName}</p>
              {tripStatus ? (
                <div className="mt-2">
                  <TripStatusBadge status={tripStatus} label={tripStatusLabel ?? tripStatus} />
                </div>
              ) : null}
            </div>
            <nav className="mt-4 space-y-1">
              {tripNav.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={[
                    "block rounded-lg px-3 py-2 text-sm font-medium",
                    pathname === item.href ? "bg-zinc-100" : "text-zinc-600 hover:bg-zinc-50",
                  ].join(" ")}
                >
                  {item.label}
                </Link>
              ))}
            </nav>
          </div>
        ) : null}
      </aside>
      <main className="min-h-0 min-w-0 flex-1 overflow-auto">{children}</main>
      {!isSetupRoute && tripId ? <HostMobileLinkCard tripId={tripId} /> : null}
    </div>
  );
}
