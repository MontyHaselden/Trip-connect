import { deriveEngineViewFromGraph } from "@/lib/trip-engine/build-setup-response";
import type { CostLedgerProjection } from "@/lib/trip-engine/cost-ledger/types";
import type {
  CalendarProjection,
  CalendarRenderModel,
  TripEntityGraph,
} from "@/lib/trip-engine/types";

/** Calendar view for the selected lens — always derived from the live graph. */
export function calendarViewForLens(
  graph: TripEntityGraph,
  groupId: string,
  cached: {
    calendarRenderModel: CalendarRenderModel;
    calendarProjection: CalendarProjection;
    costLedger: CostLedgerProjection | null;
  },
): { calendarRenderModel: CalendarRenderModel; calendarProjection: CalendarProjection } {
  const derived = deriveEngineViewFromGraph(graph, {
    groupId,
    costLedger: cached.costLedger,
  });
  return {
    calendarRenderModel: derived.calendarRenderModel,
    calendarProjection: derived.calendarProjection,
  };
}
