"use client";

import type { SetupSectionId } from "@/lib/host/setup/types";
import type { TripCommand } from "@/lib/trip-engine/commands";
import type {
  EngineConflict,
  EngineWarning,
  ProjectedDay,
  TripEntityGraph,
} from "@/lib/trip-engine/types";

import { AccommodationSection } from "./sections/AccommodationSection";
import { ActivitiesSection } from "./sections/ActivitiesSection";
import { GroupsSection } from "./sections/GroupsSection";
import { LocationsSection } from "./sections/LocationsSection";
import { OverviewSection } from "./sections/OverviewSection";
import { PlaceholderSection } from "./sections/PlaceholderSection";
import { TransportSection } from "./sections/TransportSection";

export function SetupInspector(props: {
  section: SetupSectionId;
  graph: TripEntityGraph;
  groupId: string;
  tripId: string;
  selectedDay: ProjectedDay | null;
  warnings: EngineWarning[];
  conflicts: EngineConflict[];
  onDispatch: (commands: TripCommand[]) => Promise<boolean>;
}) {
  const { graph, groupId, tripId, onDispatch } = props;

  switch (props.section) {
    case "overview":
      return (
        <OverviewSection
          graph={graph}
          selectedDay={props.selectedDay}
          warnings={props.warnings}
          conflicts={props.conflicts}
          onUpdateName={(name) => void onDispatch([{ type: "updateBasics", basics: { name } }])}
        />
      );
    case "locations":
      return (
        <LocationsSection
          graph={graph}
          groupId={groupId}
          selectedDate={props.selectedDay?.date ?? null}
          onDispatch={onDispatch}
        />
      );
    case "accommodation":
      return <AccommodationSection graph={graph} groupId={groupId} onDispatch={onDispatch} />;
    case "transport":
      return <TransportSection graph={graph} groupId={groupId} onDispatch={onDispatch} />;
    case "activities":
      return (
        <ActivitiesSection
          graph={graph}
          groupId={groupId}
          selectedDate={props.selectedDay?.date ?? null}
          onDispatch={onDispatch}
        />
      );
    case "groups":
      return <GroupsSection graph={graph} onDispatch={onDispatch} />;
    case "participants":
      return (
        <PlaceholderSection
          title="Participants"
          message="Roster management stays in the classic dashboard for now."
          href={`/dashboard/trips/${tripId}/participants`}
        />
      );
    case "bookings":
      return (
        <PlaceholderSection
          title="Bookings & references"
          message={`${graph.bookingsSummary.length} booking record(s) loaded in graph.`}
        />
      );
    case "emergency":
      return (
        <PlaceholderSection
          title="Emergency"
          message={
            graph.emergencySummary.localEmergencyNumber
              ? `Local emergency: ${graph.emergencySummary.localEmergencyNumber}`
              : "Emergency info not set yet."
          }
        />
      );
    case "photos_viewers":
      return (
        <PlaceholderSection
          title="Photos & viewers"
          message="Gallery and viewer settings — placeholder in engine preview."
        />
      );
    case "publish":
      return (
        <PlaceholderSection
          title="Publish"
          message={`Published v${graph.publishSummary.publishedVersion}. Use builder to publish.`}
          href={`/dashboard/trips/${tripId}/builder`}
        />
      );
    default:
      return <PlaceholderSection title={props.section} message="Section not implemented." />;
  }
}
