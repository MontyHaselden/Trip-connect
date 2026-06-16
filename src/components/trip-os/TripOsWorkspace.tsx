"use client";

import type { SetupSectionId } from "@/lib/host/setup/types";
import type { TripCommand } from "@/lib/trip-engine/commands";
import type {
  EngineConflict,
  EngineSectionReadiness,
  EngineWarning,
  ProjectedDay,
  TripEntityGraph,
} from "@/lib/trip-engine/types";

import { IngestPanel } from "./ingest/IngestPanel";
import { MapView } from "./map/MapView";
import { SmartOverview } from "./overview/SmartOverview";
import { AccommodationSection } from "./sections/AccommodationSection";
import { ActivitiesSection } from "./sections/ActivitiesSection";
import { BookingsSection } from "./sections/BookingsSection";
import { GroupsSection } from "./sections/GroupsSection";
import { LocationsSection } from "./sections/LocationsSection";
import { TransportSection } from "./sections/TransportSection";

export type TripOsSection = SetupSectionId | "ingest" | "map";

export function TripOsWorkspace(props: {
  section: TripOsSection;
  graph: TripEntityGraph;
  groupId: string;
  tripId: string;
  readiness: EngineSectionReadiness[];
  selectedDay: ProjectedDay | null;
  warnings: EngineWarning[];
  conflicts: EngineConflict[];
  onDispatch: (commands: TripCommand[]) => Promise<boolean>;
  onNavigateSection: (section: TripOsSection) => void;
  onReload: () => void;
  saving?: boolean;
}) {
  const { graph, groupId, tripId, onDispatch, saving } = props;

  switch (props.section) {
    case "overview":
      return (
        <SmartOverview
          graph={graph}
          readiness={props.readiness}
          selectedDay={props.selectedDay}
          warnings={props.warnings}
          conflicts={props.conflicts}
          onUpdateName={(name) => void onDispatch([{ type: "updateBasics", basics: { name } }])}
          onNavigateSection={(s) => props.onNavigateSection(s as TripOsSection)}
        />
      );
    case "ingest":
      return (
        <IngestPanel
          tripId={tripId}
          graph={graph}
          groupId={groupId}
          saving={saving}
          onDispatch={onDispatch}
          onReload={props.onReload}
        />
      );
    case "map":
      return <MapView graph={graph} groupId={groupId} />;
    case "locations":
      return (
        <LocationsSection
          graph={graph}
          groupId={groupId}
          selectedDate={props.selectedDay?.date ?? null}
          saving={saving}
          onDispatch={onDispatch}
        />
      );
    case "accommodation":
      return (
        <AccommodationSection
          graph={graph}
          groupId={groupId}
          selectedDate={props.selectedDay?.date ?? null}
          saving={saving}
          onDispatch={onDispatch}
        />
      );
    case "transport":
      return (
        <TransportSection
          graph={graph}
          groupId={groupId}
          selectedDate={props.selectedDay?.date ?? null}
          saving={saving}
          onDispatch={onDispatch}
        />
      );
    case "activities":
      return (
        <ActivitiesSection
          graph={graph}
          groupId={groupId}
          selectedDate={props.selectedDay?.date ?? null}
          saving={saving}
          onDispatch={onDispatch}
        />
      );
    case "groups":
      return <GroupsSection graph={graph} saving={saving} onDispatch={onDispatch} />;
    case "bookings":
      return <BookingsSection graph={graph} tripId={tripId} />;
    default:
      return (
        <div className="rounded-xl border border-dashed border-zinc-300 p-6 text-sm text-zinc-600">
          Section &quot;{props.section}&quot; — use classic dashboard for participants, photos, publish.
        </div>
      );
  }
}
