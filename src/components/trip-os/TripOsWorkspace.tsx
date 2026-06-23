"use client";

import type { SetupSectionId } from "@/lib/host/setup/types";
import type { TripCommand } from "@/lib/trip-engine/commands";
import type { CostLedgerProjection } from "@/lib/trip-engine/cost-ledger/types";
import type {
  EngineConflict,
  EngineSectionReadiness,
  EngineWarning,
  ProjectedDay,
  RosterSummary,
  TripEntityGraph,
} from "@/lib/trip-engine/types";

import type { CalendarSelection } from "./calendar/useCalendarSelection";
import { EMPTY_CALENDAR_SELECTION } from "@/lib/host/setup/calendar-range-selection";

import { IngestPanel } from "./ingest/IngestPanel";
import { MapView } from "./map/MapView";
import { SmartOverview } from "./overview/SmartOverview";
import { calendarHasPaint } from "@/lib/trip-engine/calendar-has-paint";
import { AccommodationSection } from "./sections/AccommodationSection";
import { ActivitiesSection } from "./sections/ActivitiesSection";
import { BookingsSection } from "./sections/BookingsSection";
import { FinanceSection } from "./sections/FinanceSection";
import { JoinLinksSection } from "./sections/JoinLinksSection";
import { LocationsSection } from "./sections/LocationsSection";
import { TransportSection } from "./sections/TransportSection";
import { ParticipantViewSection } from "./sections/ParticipantViewSection";
import { UsersSection } from "./sections/UsersSection";

export type TripOsSection = SetupSectionId | "ingest" | "map" | "participant-view" | "join-links";

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
  onRosterChanged?: () => void;
  saving?: boolean;
  participantViewRefreshKey?: number;
  rosterSummary?: RosterSummary;
  costLedger?: CostLedgerProjection | null;
  onCostsAction?: (payload: Record<string, unknown>) => Promise<boolean>;
  calendarSelection?: CalendarSelection;
  onHighlightDayFromMap?: (iso: string) => void;
  onGoToDateFromMap?: (iso: string) => void;
}) {
  const { graph, groupId, tripId, inviteCode, onDispatch, saving } = props;

  switch (props.section) {
    case "overview":
      return (
        <SmartOverview
          graph={graph}
          groupId={groupId}
          readiness={props.readiness}
          selectedDay={props.selectedDay}
          warnings={props.warnings}
          conflicts={props.conflicts}
          costLedger={props.costLedger ?? null}
          rosterSummary={props.rosterSummary}
          onUpdateName={(name) => void onDispatch([{ type: "updateBasics", basics: { name } }])}
          onNavigateSection={(s) => props.onNavigateSection(s as TripOsSection)}
        />
      );
    case "ingest":
      return (
        <div className="flex min-h-0 flex-1 flex-col">
          <IngestPanel
            tripId={tripId}
            groupId={groupId}
            timezone={graph.basics.timezone}
            calendarHasPaint={calendarHasPaint(graph, groupId)}
            onReload={props.onReload}
            onDispatch={onDispatch}
          />
        </div>
      );
    case "map":
      return (
        <MapView
          graph={graph}
          groupId={groupId}
          calendarSelection={props.calendarSelection ?? { ...EMPTY_CALENDAR_SELECTION }}
          onHighlightDay={props.onHighlightDayFromMap ?? (() => {})}
          onGoToDate={props.onGoToDateFromMap ?? (() => {})}
          onNavigateSection={(s) => props.onNavigateSection(s)}
        />
      );
    case "locations":
      return (
        <LocationsSection graph={graph} groupId={groupId} selectedDate={props.selectedDay?.date ?? null} />
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
    case "accommodation":
      return (
        <AccommodationSection
          graph={graph}
          groupId={groupId}
          tripId={tripId}
          inviteCode={inviteCode}
          rosterSummary={props.rosterSummary}
          selectedDate={props.selectedDay?.date ?? null}
          saving={saving}
          onDispatch={onDispatch}
          onReload={props.onReload}
        />
      );
    case "activities":
      return (
        <ActivitiesSection
          graph={graph}
          groupId={groupId}
          saving={saving}
          onDispatch={onDispatch}
        />
      );
    case "participants":
      return <UsersSection inviteCode={inviteCode} onRosterChanged={props.onRosterChanged} />;
    case "join-links":
      return <JoinLinksSection inviteCode={inviteCode} />;
    case "bookings":
      return <BookingsSection graph={graph} tripId={tripId} />;
    case "finance":
      return (
        <FinanceSection
          roster={props.rosterSummary ?? { participants: [], groups: [], rooms: [] }}
          graph={graph}
          costLedger={props.costLedger ?? null}
          onFinanceAction={async (payload) =>
            props.onCostsAction ? props.onCostsAction(payload) : false
          }
          saving={saving}
        />
      );
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
