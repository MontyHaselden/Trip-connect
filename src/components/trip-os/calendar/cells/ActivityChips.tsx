import type { ActivityMarker } from "@/lib/trip-engine/types";

import { ActivityMarker as ActivityMarkerChip } from "../ActivityMarker";

export function ActivityChips(props: { activities: ActivityMarker[] }) {
  if (!props.activities.length) return null;

  return (
    <div className="pointer-events-none absolute right-0.5 top-0.5 z-[25] flex max-w-[45%] flex-col items-end gap-0.5">
      {props.activities.slice(0, 2).map((a) => (
        <ActivityMarkerChip key={a.id} activity={a} />
      ))}
      {props.activities.length > 2 ? (
        <span className="rounded bg-white/80 px-1 text-[9px] text-zinc-500">
          +{props.activities.length - 2}
        </span>
      ) : null}
    </div>
  );
}
