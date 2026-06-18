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
import { LocationsSection } from "./sections/LocationsSection";
import { ParticipantViewSection } from "./sections/ParticipantViewSection";
import { TransportSection } from "./sections/TransportSection";
import { UsersSection } from "./sections/UsersSection";

export type TripOsSection = SetupSectionId | "ingest" | "map" | "participant-view";

export function TripOsWorkspace(props: {
  section: TripOsSection;
  graph: TripEntityGraph;
  groupId: string;
  tripId: string;
  inviteCode: string;
  readiness: EngineSectionReadiness[];
  selectedDay: ProjectedDay | null;
  warnings: EngineWarning[];
  conflicts: EngineConflict[];
  onDispatch: (commands: TripCommand[]) => Promise<boolean>;
  onNavigateSection: (section: TripOsSection) => void;
  onReload: () => void;
  saving?: boolean;
  participantViewRefreshKey?: number;
}) {
  const { graph, groupId, tripId, inviteCode, onDispatch, saving } = props;

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
        <div className="flex min-h-0 flex-1 flex-col">
          <IngestPanel
            tripId={tripId}
            timezone={graph.basics.timezone}
            onReload={props.onReload}
          />
        </div>
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
    case "participants":
      return <UsersSection inviteCode={inviteCode} />;
    case "bookings":
      return <BookingsSection graph={graph} tripId={tripId} />;
    case "participant-view":
      return (
        <ParticipantViewSection
          tripId={tripId}
          refreshKey={props.participantViewRefreshKey ?? 0}
        />
      );
    default:
      return (
        <div className="rounded-xl border border-dashed border-zinc-300 p-6 text-sm text-zinc-600">
          Section &quot;{props.section}&quot; — use classic dashboard for participants, photos, publish.
        </div>
      );
  }
}
