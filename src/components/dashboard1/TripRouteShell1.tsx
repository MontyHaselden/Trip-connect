"use client";

import { usePathname } from "next/navigation";

import type { TripLifecycleStatus } from "@/lib/host/trip-lifecycle";
import { isTripOsBoardPath } from "@/lib/trip-os/paths";

import { Dashboard1Shell } from "./Dashboard1Shell";

export function TripRouteShell1(props: {
  tripId: string;
  tripName: string;
  tripStatus: TripLifecycleStatus;
  tripStatusLabel: string;
  continuePath: string;
  wizardInProgress: boolean;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const isTripOsBoard = isTripOsBoardPath(pathname, props.tripId);

  if (isTripOsBoard) {
    return <div className="h-dvh min-h-0 overflow-hidden bg-white">{props.children}</div>;
  }

  return (
    <Dashboard1Shell
      tripId={props.tripId}
      tripName={props.tripName}
      tripStatus={props.tripStatus}
      tripStatusLabel={props.tripStatusLabel}
      continuePath={props.continuePath}
      wizardInProgress={props.wizardInProgress}
    >
      {props.children}
    </Dashboard1Shell>
  );
}
