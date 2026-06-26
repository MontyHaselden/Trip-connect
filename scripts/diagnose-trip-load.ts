/**
 * Diagnose trip load bottlenecks — run:
 *   npx tsx scripts/diagnose-trip-load.ts [tripId]
 */
import { loadTripGraph } from "../src/lib/trip-engine/load-trip-graph";
import { repairTransportGraphSync } from "../src/lib/trip-engine/repair-transport-graph";
import { effectiveTripBoundsFromState } from "../src/lib/host/setup/sync-trip-bounds";
import { calendarGridFromToday } from "../src/lib/host/setup/calendar-bounds";
import { enumerateDates, MAX_DATE_ENUMERATION_DAYS } from "../src/lib/host/wizard/location-stays";
import { deriveEngineViewFromGraph } from "../src/lib/trip-engine/build-setup-response";
import { stubEngineCalendarView } from "../src/lib/trip-engine/stub-engine-view";

const tripId = process.argv[2] ?? "0badae43-50ff-49ec-ad88-abd62e2d5ad3";

function sizeOf(obj: unknown): number {
  return Buffer.byteLength(JSON.stringify(obj), "utf8");
}

function countDayPlaces(graph: Awaited<ReturnType<typeof loadTripGraph>>) {
  if (!graph) return { groups: 0, total: 0, maxPerGroup: 0 };
  let total = 0;
  let maxPerGroup = 0;
  const groups = Object.keys(graph.dayPlacesByGroupId).length;
  for (const days of Object.values(graph.dayPlacesByGroupId)) {
    total += days.length;
    maxPerGroup = Math.max(maxPerGroup, days.length);
  }
  return { groups, total, maxPerGroup };
}

function dateSpanStats(graph: NonNullable<Awaited<ReturnType<typeof loadTripGraph>>>) {
  const bounds = effectiveTripBoundsFromState(graph);
  const grid = calendarGridFromToday({
    startDate: bounds.startDate,
    endDate: bounds.endDate,
    timezone: graph.basics.timezone,
    dayPlaces: graph.dayPlacesByGroupId[graph.mainGroupId],
    accommodationStays: graph.accommodationStays,
  });
  const enumSpan = enumerateDates(grid.gridStart, grid.gridEnd);
  const allDates = new Set<string>();
  for (const days of Object.values(graph.dayPlacesByGroupId)) {
    for (const d of days) allDates.add(d.date);
  }
  const sorted = [...allDates].sort();
  return {
    bounds,
    grid,
    enumerateDays: enumSpan.length,
    enumerateCapped: enumSpan.length >= MAX_DATE_ENUMERATION_DAYS,
    uniqueDayPlaceDates: sorted.length,
    earliestDayPlace: sorted[0] ?? null,
    latestDayPlace: sorted[sorted.length - 1] ?? null,
  };
}

async function main() {
  console.log(`\n=== Trip load diagnostic: ${tripId} ===\n`);

  const t0 = performance.now();
  const graph = await loadTripGraph(tripId);
  const loadMs = performance.now() - t0;
  if (!graph) {
    console.error("Trip not found or DB unavailable.");
    process.exit(1);
  }

  const jsonBytes = sizeOf(graph);
  const dayStats = countDayPlaces(graph);
  const span = dateSpanStats(graph);

  console.log("--- Payload ---");
  console.log(`  Server loadTripGraph:     ${loadMs.toFixed(0)} ms`);
  console.log(`  JSON size (serialized):   ${(jsonBytes / 1024 / 1024).toFixed(2)} MB`);
  console.log(`  Groups:                   ${graph.groups.length}`);
  console.log(`  Day-place rows:           ${dayStats.total} (${dayStats.groups} groups, max ${dayStats.maxPerGroup}/group)`);
  console.log(`  Outbound legs:            ${graph.outboundLegs.length}`);
  console.log(`  Return legs:              ${graph.returnLegs.length}`);
  console.log(`  Intercity legs:           ${graph.intercityLegs.length}`);
  console.log(`  Accommodation stays:      ${graph.accommodationStays.length}`);
  console.log(`  Activities:               ${graph.activities.length}`);
  console.log(`  Transport products:       ${(graph.transportProducts ?? []).length}`);

  console.log("\n--- Dates ---");
  console.log(`  DB basics:                ${graph.basics.startDate} → ${graph.basics.endDate}`);
  console.log(`  Effective bounds:         ${span.bounds.startDate} → ${span.bounds.endDate} (fromContent=${span.bounds.fromContent})`);
  console.log(`  Calendar grid:            ${span.grid.gridStart} → ${span.grid.gridEnd}`);
  console.log(`  enumerateDates span:      ${span.enumerateDays} days${span.enumerateCapped ? " ⚠️ CAPPED" : ""}`);
  console.log(`  Day-place date range:     ${span.earliestDayPlace} → ${span.latestDayPlace} (${span.uniqueDayPlaceDates} unique)`);

  const t1 = performance.now();
  const repaired = repairTransportGraphSync(graph);
  console.log(`\n--- Client sync work ---`);
  console.log(`  repairTransportGraphSync: ${(performance.now() - t1).toFixed(0)} ms (changed=${repaired !== graph})`);

  const t2 = performance.now();
  stubEngineCalendarView(repaired, graph.mainGroupId);
  console.log(`  stubEngineCalendarView:   ${(performance.now() - t2).toFixed(0)} ms`);

  const t3 = performance.now();
  JSON.parse(JSON.stringify(graph));
  console.log(`  JSON parse+stringify:     ${(performance.now() - t3).toFixed(0)} ms`);

  const t4 = performance.now();
  try {
    const view = deriveEngineViewFromGraph(repaired, { groupId: graph.mainGroupId });
    console.log(`  deriveEngineViewFromGraph: ${(performance.now() - t4).toFixed(0)} ms`);
    console.log(`    calendar days:          ${view.calendarRenderModel.days.length}`);
    console.log(`    projected days:         ${view.calendarRenderModel.projectedDays.length}`);
  } catch (e) {
    console.error(`  deriveEngineViewFromGraph: FAILED`, e);
  }

  // Flag anomalies
  console.log("\n--- Anomalies ---");
  const issues: string[] = [];
  if (jsonBytes > 5_000_000) issues.push(`Huge payload (${(jsonBytes / 1e6).toFixed(1)}MB) — slow fetch + JSON.parse`);
  if (dayStats.total > 10_000) issues.push(`${dayStats.total} day-place rows — bloated DB`);
  if (span.enumerateCapped) issues.push("Calendar enumerateDates hit cap — corrupt far-future dates");
  if (span.latestDayPlace && span.bounds.endDate && span.latestDayPlace > span.bounds.endDate) {
    issues.push(`Day places extend past bounds (${span.latestDayPlace} > ${span.bounds.endDate})`);
  }
  if (graph.outboundLegs.length + graph.returnLegs.length + graph.intercityLegs.length > 500) {
    issues.push("Very high transport leg count");
  }
  if (issues.length === 0) console.log("  None detected — check network/Vercel timeout.");
  else issues.forEach((i) => console.log(`  ⚠️  ${i}`));

  console.log("");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
