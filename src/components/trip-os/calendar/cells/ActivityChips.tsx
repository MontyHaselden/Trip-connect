import type { ActivityMarker } from "@/lib/trip-engine/types";

import {
  CALENDAR_ACTIVITY_DOTS_PER_ROW,
  CALENDAR_ACTIVITY_DOT_LIMIT,
} from "@/lib/trip-engine/calendar-activity-dots";

const DOT_COLOR = "#2e1065";

export function ActivityChips(props: { activities: ActivityMarker[] }) {
  const dots = props.activities.slice(0, CALENDAR_ACTIVITY_DOT_LIMIT);
  if (!dots.length) return null;

  return (
    <div
      className="pointer-events-none absolute left-1 top-1 z-[35] grid gap-[3px]"
      style={{
        gridTemplateColumns: `repeat(${CALENDAR_ACTIVITY_DOTS_PER_ROW}, 6px)`,
        gridTemplateRows: "repeat(2, 6px)",
      }}
      aria-label={`${dots.length} activit${dots.length === 1 ? "y" : "ies"}`}
    >
      {dots.map((activity) => (
        <span
          key={activity.id}
          className="h-[6px] w-[6px] rounded-full ring-1 ring-white/90"
          style={{ backgroundColor: DOT_COLOR }}
          title={activity.title}
        />
      ))}
    </div>
  );
}
