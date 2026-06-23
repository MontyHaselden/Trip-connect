"use client";

import type { TripMapMarkerPopupData } from "@/lib/trip-engine/map-types";
import type { TripOsSection } from "../TripOsWorkspace";

export function TripMapPopup(props: {
  title: string;
  subtitle?: string;
  date?: string;
  extraLines?: string[];
  popupData: TripMapMarkerPopupData;
  onOpenItem: (section: TripOsSection, linkedDay: string) => void;
  onGoToDate: (date: string) => void;
}) {
  const section = props.popupData.sectionId as TripOsSection;

  return (
    <div className="min-w-[180px] max-w-[240px] space-y-2 text-sm">
      <div>
        <p className="font-semibold text-zinc-900">{props.title}</p>
        {props.subtitle ? (
          <p className="text-xs text-zinc-500">{props.subtitle}</p>
        ) : null}
        {props.date ? <p className="text-xs text-zinc-500">{props.date}</p> : null}
      </div>
      {props.extraLines?.map((line) => (
        <p key={line} className="text-xs text-zinc-600">
          {line}
        </p>
      ))}
      <div className="flex flex-wrap gap-2 pt-1">
        <button
          type="button"
          className="rounded-lg bg-zinc-900 px-2.5 py-1 text-xs font-medium text-white hover:bg-zinc-800"
          onClick={() => props.onOpenItem(section, props.popupData.linkedCalendarDay)}
        >
          Open {props.popupData.sectionId}
        </button>
        {props.popupData.linkedCalendarDay ? (
          <button
            type="button"
            className="rounded-lg border border-zinc-200 px-2.5 py-1 text-xs font-medium text-zinc-700 hover:bg-zinc-50"
            onClick={() => props.onGoToDate(props.popupData.linkedCalendarDay)}
          >
            Go to date
          </button>
        ) : null}
      </div>
    </div>
  );
}
