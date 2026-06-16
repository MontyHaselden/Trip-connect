import type { ActivityMarker as ActivityMarkerType } from "@/lib/trip-engine/types";

export function ActivityMarker(props: { activity: ActivityMarkerType }) {
  return (
    <span
      className="inline-flex max-w-full items-center gap-0.5 truncate rounded bg-violet-100 px-1 py-0.5 text-[10px] font-medium text-violet-900"
      title={props.activity.title}
    >
      ★ {props.activity.title}
    </span>
  );
}
