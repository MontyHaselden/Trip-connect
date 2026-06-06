"use client";

import { useTypewriterText } from "@/hooks/useTypewriterText";
import {
  categoryAccent,
  inferCategoryFromTitle,
  resolveCategory,
} from "@/lib/utils/itinerary-item-style";
import type { ActivityCategory } from "@/types/activity-category";
import { ACTIVITY_CATEGORIES } from "@/types/activity-category";

function blockTint(category: ReturnType<typeof resolveCategory>) {
  switch (category) {
    case "travel":
      return "bg-sky-50/80";
    case "meal":
      return "bg-amber-50/80";
    case "school":
      return "bg-indigo-50/70";
    case "activity":
      return "bg-violet-50/70";
    case "hotel":
      return "bg-teal-50/80";
    case "meeting":
      return "bg-rose-50/70";
    case "important":
      return "bg-emerald-50/80";
    default:
      return "bg-white";
  }
}

export function BuildingGhostRow(props: {
  title: string;
  category: ActivityCategory | string | null;
}) {
  const parsedCategory =
    props.category &&
    ACTIVITY_CATEGORIES.includes(props.category as ActivityCategory)
      ? (props.category as ActivityCategory)
      : inferCategoryFromTitle(props.title);
  const category = resolveCategory({
    id: "ghost",
    startTime: "09:00",
    endTime: null,
    title: props.title,
    locationName: null,
    address: null,
    mapQuery: null,
    transportNote: null,
    bringNote: null,
    hostNote: null,
    category: parsedCategory,
  });
  const accent = categoryAccent(category);
  const title = useTypewriterText(props.title, true);

  return (
    <div
      style={{ height: 56, flexShrink: 0 }}
      className={[
        "flex w-full animate-pulse flex-col justify-center gap-0.5 overflow-hidden border-b border-zinc-200/70 px-3 py-2",
        blockTint(category),
      ].join(" ")}
    >
      <div className="flex min-w-0 items-center gap-2">
        <span className={["h-2 w-2 shrink-0 rounded-full", accent.dot].join(" ")} aria-hidden />
        <span className="text-[10px] font-medium uppercase tracking-wide text-zinc-500">
          {accent.label}
        </span>
      </div>
      <span className="min-w-0 text-sm font-medium leading-snug text-zinc-900">
        {title}
        <span className="ml-0.5 inline-block h-[1em] w-0.5 animate-pulse bg-zinc-400 align-middle" />
      </span>
    </div>
  );
}
