import {
  tripLocationColor,
  tripLocationTextColor,
  type LocationPaletteSwatch,
} from "@/lib/host/wizard/location-stays";
import type { DayPlaceDraft } from "@/lib/host/wizard/types";

import { corridorAbbrev, shortCity } from "./calendar-cell-labels";

export function LocationBand(props: {
  day: DayPlaceDraft;
  displayShare: number;
  showStayPaint: boolean;
  cityPaintTop?: string;
  /** Height for the left / primary-only segment (defaults to cityPaintHeight). */
  leftCityPaintHeight?: string;
  /** Height for the right / secondary segment (defaults to cityPaintHeight). */
  rightCityPaintHeight?: string;
  /** Fallback when per-side heights are omitted. */
  cityPaintHeight?: string;
  locationColorByKey?: Map<string, LocationPaletteSwatch>;
}) {
  const {
    day,
    displayShare,
    showStayPaint,
    cityPaintTop = "0",
    cityPaintHeight = "100%",
    leftCityPaintHeight,
    rightCityPaintHeight,
    locationColorByKey,
  } = props;
  const leftHeight = leftCityPaintHeight ?? cityPaintHeight;
  const rightHeight = rightCityPaintHeight ?? cityPaintHeight;
  const primary = day.primaryCity.trim();
  const secondary = day.secondaryCity?.trim() ?? "";

  if (!showStayPaint) return null;

  return (
    <>
      {primary && !secondary ? (
        <div
          className="absolute left-0 flex items-end overflow-hidden px-1.5 pb-1 pt-4"
          style={{
            top: cityPaintTop,
            height: leftHeight,
            width: `${displayShare * 100}%`,
            backgroundColor: tripLocationColor(primary, locationColorByKey),
          }}
          title={primary}
        >
          <span
            className="truncate text-[10px] font-semibold"
            style={{ color: tripLocationTextColor(primary, locationColorByKey) }}
          >
            {shortCity(primary)}
          </span>
        </div>
      ) : null}

      {!primary && secondary ? (
        <div
          className="absolute right-0 flex items-end justify-end overflow-hidden px-1.5 pb-1 pt-4"
          style={{
            top: cityPaintTop,
            height: rightHeight,
            width: `${(1 - displayShare) * 100}%`,
            backgroundColor: tripLocationColor(secondary, locationColorByKey),
          }}
          title={secondary}
        >
          <span
            className="truncate text-right text-[10px] font-semibold"
            style={{ color: tripLocationTextColor(secondary, locationColorByKey) }}
          >
            {shortCity(secondary)}
          </span>
        </div>
      ) : null}

      {primary && secondary ? (
        <>
          <div
            className="absolute left-0 z-[8] flex items-end overflow-hidden px-1 pb-1 pt-5"
            style={{
              top: cityPaintTop,
              height: leftHeight,
              width: `${displayShare * 100}%`,
              backgroundColor: tripLocationColor(primary, locationColorByKey),
            }}
            title={primary}
          >
            <span
              className="truncate text-[10px] font-semibold"
              style={{ color: tripLocationTextColor(primary, locationColorByKey) }}
            >
              {corridorAbbrev(primary)}
            </span>
          </div>
          <div
            className="absolute right-0 z-[8] flex items-end justify-end overflow-hidden px-1 pb-1 pt-5"
            style={{
              top: cityPaintTop,
              height: rightHeight,
              width: `${(1 - displayShare) * 100}%`,
              backgroundColor: tripLocationColor(secondary, locationColorByKey),
            }}
            title={secondary}
          >
            <span
              className="truncate text-right text-[10px] font-semibold"
              style={{ color: tripLocationTextColor(secondary, locationColorByKey) }}
            >
              {corridorAbbrev(secondary)}
            </span>
          </div>
        </>
      ) : null}
    </>
  );
}
