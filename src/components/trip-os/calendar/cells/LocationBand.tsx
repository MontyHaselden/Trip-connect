import {
  locationColor,
  locationTextColor,
  DEFAULT_HALF_SHARE,
} from "@/lib/host/wizard/location-stays";
import type { DayPlaceDraft } from "@/lib/host/wizard/types";
import type { OverlayMeta } from "@/lib/trip-engine/types";

import { corridorAbbrev, shortCity } from "./calendar-cell-labels";

export function LocationBand(props: {
  day: DayPlaceDraft;
  baseDay?: DayPlaceDraft | null;
  overlayKind?: OverlayMeta;
  displayShare: number;
  showStayPaint: boolean;
  cityPaintHeight: string;
}) {
  const { day, baseDay, overlayKind, displayShare, showStayPaint, cityPaintHeight } = props;
  const primary = day.primaryCity.trim();
  const secondary = day.secondaryCity?.trim() ?? "";
  const isSplit = Boolean(primary && (secondary || (day.primaryShare ?? 1) < 1));

  if (!showStayPaint) return null;

  return (
    <>
      {baseDay?.primaryCity.trim() ? (
        <div
          className={[
            "pointer-events-none absolute inset-0 z-[5] rounded-xl border border-dashed border-zinc-300/70",
            overlayKind === "inherit" ? "opacity-35" : "opacity-25",
          ].join(" ")}
          aria-hidden
        >
          <div
            className="absolute inset-y-0 left-0 flex items-end overflow-hidden px-1.5 pb-1.5 pt-6"
            style={{
              width: `${(baseDay.primaryShare ?? 1) * 100}%`,
              backgroundColor: locationColor(baseDay.primaryCity),
            }}
          >
            <span
              className="truncate text-[10px] font-medium text-zinc-600"
              title={baseDay.primaryCity}
            >
              {shortCity(baseDay.primaryCity)}
            </span>
          </div>
        </div>
      ) : null}

      {primary && !secondary ? (
        <div
          className="absolute left-0 top-0 flex items-end overflow-hidden px-1.5 pb-1 pt-4"
          style={{
            height: cityPaintHeight,
            width: `${displayShare * 100}%`,
            backgroundColor: locationColor(primary),
          }}
          title={primary}
        >
          <span
            className="truncate text-[10px] font-semibold"
            style={{ color: locationTextColor(primary) }}
          >
            {shortCity(primary)}
          </span>
        </div>
      ) : null}

      {!primary && secondary ? (
        <div
          className="absolute right-0 top-0 flex items-end justify-end overflow-hidden px-1.5 pb-1 pt-4"
          style={{
            height: cityPaintHeight,
            width: `${(1 - displayShare) * 100}%`,
            backgroundColor: locationColor(secondary),
          }}
          title={secondary}
        >
          <span
            className="truncate text-right text-[10px] font-semibold"
            style={{ color: locationTextColor(secondary) }}
          >
            {shortCity(secondary)}
          </span>
        </div>
      ) : null}

      {primary && secondary ? (
        <>
          <div
            className="absolute inset-y-0 left-0 z-[8] flex items-end overflow-hidden px-1 pb-1 pt-5"
            style={{
              width: `${displayShare * 100}%`,
              backgroundColor: locationColor(primary),
            }}
            title={primary}
          >
            <span
              className="truncate text-[10px] font-semibold"
              style={{ color: locationTextColor(primary) }}
            >
              {corridorAbbrev(primary)}
            </span>
          </div>
          <div
            className="absolute inset-y-0 right-0 z-[8] flex items-end justify-end overflow-hidden px-1 pb-1 pt-5"
            style={{
              width: `${DEFAULT_HALF_SHARE * 100}%`,
              backgroundColor: locationColor(secondary),
            }}
            title={secondary}
          >
            <span
              className="truncate text-right text-[10px] font-semibold"
              style={{ color: locationTextColor(secondary) }}
            >
              {corridorAbbrev(secondary)}
            </span>
          </div>
          {isSplit ? (
            <div
              className="pointer-events-none absolute inset-y-0 z-[9] w-px bg-zinc-400/80"
              style={{ left: `${displayShare * 100}%` }}
              aria-hidden
            />
          ) : null}
        </>
      ) : null}
    </>
  );
}
