"use client";

import dynamic from "next/dynamic";

import { TripOsShellPlaceholder } from "./TripOsShellPlaceholder";

const TripOsBoard = dynamic(
  () => import("./TripOsBoard").then((mod) => mod.TripOsBoard),
  {
    ssr: false,
    loading: () => <TripOsShellPlaceholder />,
  },
);

export function TripOsBoardEntry(props: { tripId: string }) {
  return <TripOsBoard tripId={props.tripId} />;
}
