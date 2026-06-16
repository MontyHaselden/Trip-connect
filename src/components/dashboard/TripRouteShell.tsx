"use client";

import { usePathname } from "next/navigation";

import type { TripLifecycleStatus } from "@/lib/host/trip-lifecycle";

import { DashboardShell } from "./DashboardShell";

export function TripRouteShell(props: {
  tripId: string;
  tripName: string;
  tripStatus: TripLifecycleStatus;
  tripStatusLabel: string;
  continuePath: string;
  wizardInProgress: boolean;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const isSetup = pathname.includes(`/trips/${props.tripId}/setup`);

  if (isSetup) {
    return <div className="h-dvh min-h-0 overflow-hidden bg-white">{props.children}</div>;
  }

  return (
    <DashboardShell
      tripId={props.tripId}
      tripName={props.tripName}
      tripStatus={props.tripStatus}
      tripStatusLabel={props.tripStatusLabel}
      continuePath={props.continuePath}
      wizardInProgress={props.wizardInProgress}
    >
      {props.children}
    </DashboardShell>
  );
}
