import { deriveEngineViewFromGraph } from "@/lib/trip-engine/build-setup-response";
import type { CostLedgerProjection } from "@/lib/trip-engine/cost-ledger/types";
import type {
  CalendarProjection,
  CalendarRenderModel,
  TripEntityGraph,
} from "@/lib/trip-engine/types";

/** Calendar view for the selected lens — derives immediately when the cached model is stale. */
export function calendarViewForLens(
  graph: TripEntityGraph,
  groupId: string,
  cached: {
    calendarRenderModel: CalendarRenderModel;
    calendarProjection: CalendarProjection;
    costLedger: CostLedgerProjection | null;
  },
): { calendarRenderModel: CalendarRenderModel; calendarProjection: CalendarProjection } {
  const model = cached.calendarRenderModel;
  const projection = cached.calendarProjection;
  const inSync =
    model.groupId === groupId &&
    projection.groupId === groupId &&
    model.days.length > 0 &&
    projection.days.length > 0;

  if (inSync) {
    return { calendarRenderModel: model, calendarProjection: projection };
  }

  const derived = deriveEngineViewFromGraph(graph, {
    groupId,
    costLedger: cached.costLedger,
  });
  return {
    calendarRenderModel: derived.calendarRenderModel,
    calendarProjection: derived.calendarProjection,
  };
}
