import { buildSnapshotV1 } from "@/lib/publish/build-snapshot";
import { assertCalendarInvariant } from "@/lib/host/setup/derive-calendar";
import type { PublishedTripSnapshotV1 } from "@/types/published-trip";
import { projectCalendar } from "./project-calendar";
import { saveTripEntityGraph } from "./save-graph";
import type { EngineWarning, TripEntityGraph } from "./types";

export type PublishPrepResult = {
  snapshot: PublishedTripSnapshotV1;
  warnings: EngineWarning[];
};

/** Persist graph then build publish snapshot from DB (single publish path). */
export async function publishFromGraph(
  graph: TripEntityGraph,
  version: number,
): Promise<PublishPrepResult> {
  const warnings: EngineWarning[] = [];
  const projection = projectCalendar(graph);
  const invariantErrors = assertCalendarInvariant({
    dayPlaces: projection.days.map((d) => ({
      date: d.date,
      primaryCity: d.primaryCity,
      secondaryCity: d.secondaryCity,
      primaryShare: d.primaryShare,
      dayType: d.dayType,
      includeBuffer: false,
    })),
    accommodationByDate: projection.accommodationByDate,
    boundaries: projection.boundaries,
  });
  for (const msg of invariantErrors) {
    warnings.push({
      id: `calendar-invariant-${warnings.length}`,
      severity: "error",
      section: "publish",
      message: msg,
    });
  }

  await saveTripEntityGraph(graph);
  const snapshot = await buildSnapshotV1(graph.tripId, version);
  return { snapshot, warnings };
}
