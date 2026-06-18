import { isAirportRouteLabel, parseAirportRouteLabel } from "@/lib/geo/airport-codes";
import {
  tripLocationBorderColor,
  tripLocationColor,
  tripLocationTextColor,
  DEFAULT_HALF_SHARE,
  type LocationPaletteSwatch,
} from "@/lib/host/wizard/location-stays";
import {
  TRANSPORT_CORRIDOR_LEFT_SHARE,
  TRANSPORT_CORRIDOR_WIDTH,
  transferCityCode,
} from "@/lib/host/setup/transport-corridor";
import type { CalendarDaySegment } from "@/lib/host/wizard/transport-day-placement";

import { AirportRouteStack } from "./AirportRouteStack";
import { corridorAbbrev } from "./calendar-cell-labels";

const MIN_LABEL_SHARE = 0.18;
const TRAVEL_QUARTER = 0.25;

type StayBandStyle = {
  fill: string;
  border: string;
  text: string;
};

function shortTransitLabel(label: string, widthShare: number): string | null {
  if (isAirportRouteLabel(label)) {
    return widthShare >= 0.35 ? label : null;
  }
  if (widthShare >= 0.45) return label;
  const arrowMatch = /→\s*([^(]+)/.exec(label);
  if (arrowMatch?.[1]) return `→ ${arrowMatch[1].trim()}`;
  if (label.length <= 12) return label;
  return widthShare < 0.28 ? "Fly" : label.slice(0, 11) + "…";
}

function citySegmentLabel(city: string, widthShare: number): string {
  const maxLen = widthShare < 0.28 ? 8 : widthShare < 0.35 ? 10 : widthShare < 0.5 ? 14 : 18;
  const trimmed = city.trim();
  const cityOnly = trimmed.split(",")[0]?.trim() || trimmed;
  if (cityOnly.length <= maxLen) return cityOnly;
  return `${cityOnly.slice(0, maxLen - 1)}…`;
}

function segmentLabel(segment: CalendarDaySegment, widthShare: number): string | null {
  if (widthShare < MIN_LABEL_SHARE) return null;
  if (segment.kind === "city") return citySegmentLabel(segment.city, widthShare);
  return shortTransitLabel(segment.label, widthShare);
}

function transitAirportCodes(label: string): string[] {
  if (isAirportRouteLabel(label)) return parseAirportRouteLabel(label);
  return [];
}

function showAirportStack(_widthShare: number, codes: string[]): boolean {
  return codes.length >= 2;
}

export function TravelSegments({
  segments,
  locationColorByKey,
}: {
  segments: CalendarDaySegment[];
  locationColorByKey?: Map<string, LocationPaletteSwatch>;
}) {
  return (
    <>
      {segments.map((segment, i) => {
        const widthShare = segment.end - segment.start;
        const width = widthShare * 100;
        const left = segment.start * 100;
        const label = segmentLabel(segment, widthShare);
        const title = segment.kind === "city" ? segment.city.trim() : segment.label;
        const airportCodes =
          segment.kind === "transit" ? transitAirportCodes(segment.label) : [];
        const stackCodes = showAirportStack(widthShare, airportCodes);
        const narrowCity = segment.kind === "city" && widthShare <= TRAVEL_QUARTER + 0.02;

        if (segment.kind === "city") {
          const colorOnly = segment.colorOnly === true;
          return (
            <div
              key={`seg-${i}`}
              className={[
                "absolute inset-y-0 flex overflow-hidden px-0.5 pt-6",
                colorOnly || narrowCity
                  ? "items-center justify-center pb-1"
                  : "items-end pb-1.5",
              ].join(" ")}
              style={{
                left: `${left}%`,
                width: `${width}%`,
                backgroundColor: tripLocationColor(segment.city, locationColorByKey),
                borderRight:
                  i < segments.length - 1
                    ? `2px solid ${tripLocationBorderColor(segment.city, locationColorByKey)}`
                    : undefined,
              }}
              title={title}
            >
              {!colorOnly && label ? (
                <span
                  className={[
                    "font-semibold leading-tight tracking-tight",
                    narrowCity ? "text-[9px]" : "truncate text-[10px]",
                  ].join(" ")}
                  style={{ color: tripLocationTextColor(segment.city, locationColorByKey) }}
                >
                  {label}
                </span>
              ) : null}
            </div>
          );
        }

        const tentative = segment.kind === "transit" && segment.tentative;
        return (
          <div
            key={`seg-${i}`}
            className={[
              "pointer-events-none absolute inset-y-0 z-[15] flex items-center justify-center overflow-hidden border-x-2 px-0.5 pt-5",
              tentative
                ? "border-rose-400/70 bg-rose-200/90"
                : "border-indigo-400/60 bg-zinc-300/85",
            ].join(" ")}
            style={{ left: `${left}%`, width: `${width}%` }}
            title={title}
            aria-hidden
          >
            {stackCodes ? (
              <AirportRouteStack codes={airportCodes} />
            ) : label ? (
              <span
                className={[
                  "truncate px-0.5 text-center text-[9px] font-semibold",
                  tentative ? "text-rose-900" : "text-zinc-600",
                ].join(" ")}
              >
                {label}
              </span>
            ) : null}
          </div>
        );
      })}
    </>
  );
}

export function TransportBand(props: {
  segments?: CalendarDaySegment[];
  showTransportCorridor: boolean;
  primary?: string;
  secondary?: string;
  corridorDepartureAcco?: string | null;
  corridorArrivalAcco?: string | null;
  corridorRouteLabel?: string | null;
  locationColorByKey?: Map<string, LocationPaletteSwatch>;
  corridorDepartureAccoColors?: StayBandStyle | null;
  corridorArrivalAccoColors?: StayBandStyle | null;
  onTransportCorridorClick?: () => void;
  onTransitClick?: () => void;
}) {
  const {
    segments,
    showTransportCorridor,
    primary,
    secondary,
    corridorDepartureAcco,
    corridorArrivalAcco,
    corridorRouteLabel,
    locationColorByKey,
    corridorDepartureAccoColors,
    corridorArrivalAccoColors,
    onTransportCorridorClick,
    onTransitClick,
  } = props;

  const hasTravelLayout = Boolean(segments?.length);
  const corridorAirportCodes = corridorRouteLabel ? transitAirportCodes(corridorRouteLabel) : [];
  const transitRouteLabel =
    corridorRouteLabel ??
    segments
      ?.filter((segment) => segment.kind === "transit")
      .map((segment) => segment.label)
      .find((label) => transitAirportCodes(label).length >= 2) ??
    null;
  const corridorCodes = transitRouteLabel ? transitAirportCodes(transitRouteLabel) : corridorAirportCodes;

  return (
    <>
      {hasTravelLayout && segments && !showTransportCorridor ? (
        <TravelSegments segments={segments} locationColorByKey={locationColorByKey} />
      ) : null}

      {hasTravelLayout && segments && onTransitClick
        ? segments
            .filter((segment) => segment.kind === "transit")
            .map((segment, i) => (
              <button
                key={`transit-click-${i}`}
                type="button"
                className="absolute inset-y-0 z-[20] cursor-pointer border-x-2 border-indigo-500/80 bg-indigo-300/25 hover:bg-indigo-400/35"
                style={{
                  left: `${segment.start * 100}%`,
                  width: `${Math.max((segment.end - segment.start) * 100, 10)}%`,
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  onTransitClick();
                }}
                aria-label="Open transport for this travel day"
                title="Transport"
              />
            ))
        : null}

      {showTransportCorridor && primary && secondary ? (
        <>
          <div
            className="absolute inset-y-0 left-0 z-[8] flex flex-col overflow-hidden"
            style={{ width: `${TRANSPORT_CORRIDOR_LEFT_SHARE * 100}%` }}
          >
            <div
              className="relative h-3/4 min-h-0 shrink-0 px-1 pb-1 pt-4"
              style={{ backgroundColor: tripLocationColor(primary, locationColorByKey) }}
              title={primary}
            >
              <span
                className="absolute bottom-1 left-1 truncate text-[9px] font-semibold leading-tight"
                style={{ color: tripLocationTextColor(primary, locationColorByKey), maxWidth: "calc(100% - 0.25rem)" }}
              >
                {corridorAbbrev(primary)}
              </span>
            </div>
            <div
              className={[
                "relative h-1/4 min-h-0 shrink-0 px-1",
                corridorDepartureAcco && !corridorDepartureAccoColors
                  ? "border-t border-violet-300/70 bg-violet-100"
                  : corridorDepartureAcco
                    ? "border-t"
                    : "",
              ].join(" ")}
              style={
                corridorDepartureAcco && corridorDepartureAccoColors
                  ? {
                      backgroundColor: corridorDepartureAccoColors.fill,
                      borderTopColor: corridorDepartureAccoColors.border,
                    }
                  : corridorDepartureAcco
                    ? undefined
                    : { backgroundColor: tripLocationColor(primary, locationColorByKey) }
              }
              title={corridorDepartureAcco ?? undefined}
            >
              {corridorDepartureAcco ? (
                <span
                  className={[
                    "absolute bottom-0.5 left-1 truncate text-[8px] font-semibold leading-tight",
                    corridorDepartureAccoColors ? "" : "text-violet-950",
                  ].join(" ")}
                  style={
                    corridorDepartureAccoColors
                      ? { color: corridorDepartureAccoColors.text }
                      : undefined
                  }
                >
                  {corridorAbbrev(corridorDepartureAcco)}
                </span>
              ) : null}
            </div>
          </div>
          {onTransportCorridorClick ? (
            <button
              type="button"
              className="absolute inset-y-0 z-[18] flex cursor-pointer flex-col items-center justify-center border-x-2 border-indigo-400/70 bg-zinc-200/95 hover:bg-zinc-300"
              style={{
                left: `${TRANSPORT_CORRIDOR_LEFT_SHARE * 100}%`,
                width: `${TRANSPORT_CORRIDOR_WIDTH * 100}%`,
              }}
              onClick={(e) => {
                e.stopPropagation();
                onTransportCorridorClick();
              }}
              aria-label="Plan transport for this transfer day"
              title={transitRouteLabel ?? `${transferCityCode(primary)} → ${transferCityCode(secondary)}`}
            >
              {corridorCodes.length >= 2 ? (
                <AirportRouteStack codes={corridorCodes} />
              ) : (
                <span className="text-xl font-semibold text-zinc-600">→</span>
              )}
            </button>
          ) : null}
          <div
            className="absolute inset-y-0 right-0 z-[8] flex flex-col overflow-hidden"
            style={{ width: `${DEFAULT_HALF_SHARE * 100}%` }}
          >
            <div
              className="relative h-3/4 min-h-0 shrink-0 px-1 pb-1 pt-4"
              style={{ backgroundColor: tripLocationColor(secondary, locationColorByKey) }}
              title={secondary}
            >
              <span
                className="absolute bottom-1 right-1 truncate text-right text-[9px] font-semibold leading-tight"
                style={{ color: tripLocationTextColor(secondary, locationColorByKey), maxWidth: "calc(100% - 0.25rem)" }}
              >
                {corridorAbbrev(secondary)}
              </span>
            </div>
            <div
              className={[
                "relative h-1/4 min-h-0 shrink-0 px-1",
                corridorArrivalAcco && !corridorArrivalAccoColors
                  ? "border-t border-violet-300/70 bg-violet-100"
                  : corridorArrivalAcco
                    ? "border-t"
                    : "",
              ].join(" ")}
              style={
                corridorArrivalAcco && corridorArrivalAccoColors
                  ? {
                      backgroundColor: corridorArrivalAccoColors.fill,
                      borderTopColor: corridorArrivalAccoColors.border,
                    }
                  : corridorArrivalAcco
                    ? undefined
                    : { backgroundColor: tripLocationColor(secondary, locationColorByKey) }
              }
              title={corridorArrivalAcco ?? undefined}
            >
              {corridorArrivalAcco ? (
                <span
                  className={[
                    "absolute bottom-0.5 right-1 truncate text-right text-[8px] font-semibold leading-tight",
                    corridorArrivalAccoColors ? "" : "text-violet-950",
                  ].join(" ")}
                  style={
                    corridorArrivalAccoColors
                      ? { color: corridorArrivalAccoColors.text }
                      : undefined
                  }
                >
                  {corridorAbbrev(corridorArrivalAcco)}
                </span>
              ) : null}
            </div>
          </div>
        </>
      ) : null}
    </>
  );
}
