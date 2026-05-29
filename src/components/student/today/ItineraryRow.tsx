"use client";

import { useState } from "react";

import { formatItineraryTimeRange } from "@/lib/utils/time";
import { buildMapsSearchUrl } from "@/lib/utils/maps";
import {
  durationLabel,
  inferKind,
  itemExtraInfoLines,
  itemLocationLine,
  kindAccent,
  type ItineraryRowItem,
} from "@/lib/utils/itinerary-item-style";

export type { ItineraryRowItem };

function ItemInfoButton(props: {
  expanded: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={props.onToggle}
      aria-expanded={props.expanded}
      aria-label={props.expanded ? "Hide details" : "Show details"}
      className={[
        "inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold",
        props.expanded
          ? "bg-zinc-800 text-white"
          : "bg-zinc-200 text-zinc-700 ring-1 ring-inset ring-zinc-300",
      ].join(" ")}
    >
      !
    </button>
  );
}

function ItemDetails(props: {
  extraLines: string[];
  mapsUrl: string | null;
  mapsEnabled: boolean;
  compact?: boolean;
}) {
  const { extraLines, mapsUrl, mapsEnabled, compact } = props;
  if (!extraLines.length && !(mapsUrl && mapsEnabled)) return null;

  return (
    <div
      className={[
        "space-y-1 text-sm leading-relaxed text-zinc-600",
        compact ? "mt-1.5" : "mt-2",
      ].join(" ")}
    >
      {extraLines.map((line, i) => (
        <p key={i} className="break-words">
          {line}
        </p>
      ))}
      {mapsUrl && mapsEnabled ? (
        <a
          href={mapsUrl}
          target="_blank"
          rel="noreferrer"
          className="inline-flex font-medium text-zinc-700 underline decoration-zinc-300 underline-offset-2"
        >
          Map
        </a>
      ) : null}
    </div>
  );
}

function ItemTitleBlock(props: {
  item: ItineraryRowItem;
  kind: ReturnType<typeof inferKind>;
  locationLine: string | null;
  extraLines: string[];
  mapsUrl: string | null;
  mapsEnabled: boolean;
  titleClassName?: string;
}) {
  const {
    item,
    kind,
    locationLine,
    extraLines,
    mapsUrl,
    mapsEnabled,
    titleClassName = "text-[15px] font-medium",
  } = props;
  const [expanded, setExpanded] = useState(false);
  const hasDetails = extraLines.length > 0 || Boolean(mapsUrl && mapsEnabled);
  const title =
    kind === "arrival" && !/welcome/i.test(item.title)
      ? `Welcome! ${item.title}`
      : item.title;

  return (
    <>
      <div className="flex items-start gap-2">
        <p
          className={[
            "min-w-0 flex-1 break-words leading-snug text-zinc-900",
            titleClassName,
            kind === "arrival" ? "font-semibold" : "",
          ].join(" ")}
        >
          {title}
        </p>
        {hasDetails ? (
          <ItemInfoButton expanded={expanded} onToggle={() => setExpanded((v) => !v)} />
        ) : null}
      </div>
      {locationLine ? (
        <p className="mt-0.5 break-words text-sm text-zinc-500">{locationLine}</p>
      ) : null}
      {expanded ? (
        <ItemDetails
          extraLines={extraLines}
          mapsUrl={mapsUrl}
          mapsEnabled={mapsEnabled}
          compact
        />
      ) : null}
    </>
  );
}

export function ItineraryRow(props: {
  item: ItineraryRowItem;
  tripTimezone: string;
  mapsEnabled: boolean;
  isLast?: boolean;
  variant?: "default" | "featured";
  featuredLabel?: string;
}) {
  const {
    item,
    tripTimezone,
    mapsEnabled,
    isLast,
    variant = "default",
    featuredLabel,
  } = props;

  const featured = variant === "featured";
  const timeLabel = formatItineraryTimeRange(
    item.startTime,
    item.endTime,
    tripTimezone,
  );
  const kind = inferKind(item.title);
  const accent = kindAccent(kind);
  const dur = durationLabel(item.startTime, item.endTime, tripTimezone);
  const mapsQuery = item.mapQuery || item.address || "";
  const mapsUrl = mapsQuery ? buildMapsSearchUrl(mapsQuery) : null;
  const locationLine = itemLocationLine(item);
  const extraLines = itemExtraInfoLines(item);

  if (featured) {
    return (
      <article
        className={[
          "w-full min-w-0 rounded-2xl border-2 p-3.5 shadow-sm ring-1 ring-inset ring-black/5",
          accent.featured,
        ].join(" ")}
      >
        <p className="text-[11px] font-semibold uppercase tracking-widest text-zinc-500">
          {featuredLabel ?? "Now"}
        </p>
        <div className="mt-1.5 flex flex-wrap items-center gap-2">
          <p className="text-base font-semibold tabular-nums text-zinc-900">
            {timeLabel}
          </p>
          <span
            className={[
              "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset",
              accent.chip,
            ].join(" ")}
          >
            {accent.label}
          </span>
          {dur ? (
            <span className="text-xs font-medium text-zinc-600">{dur}</span>
          ) : null}
        </div>
        <div className="mt-1.5">
          <ItemTitleBlock
            item={item}
            kind={kind}
            locationLine={locationLine}
            extraLines={extraLines}
            mapsUrl={mapsUrl}
            mapsEnabled={mapsEnabled}
            titleClassName="text-lg font-bold"
          />
        </div>
      </article>
    );
  }

  return (
    <article
      className={["min-w-0 py-3", isLast ? "" : "border-b border-zinc-100"].join(" ")}
    >
      <div className="flex min-w-0 items-start gap-3">
        <div className={["mt-1 h-9 w-1 rounded-full", accent.bar].join(" ")} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-medium tabular-nums text-zinc-800">
              {timeLabel}
            </p>
            <span
              className={[
                "inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset",
                accent.chip,
              ].join(" ")}
            >
              {accent.label}
            </span>
            {dur ? (
              <span className="text-[11px] font-medium text-zinc-500">{dur}</span>
            ) : null}
          </div>
          <div className="mt-0.5">
            <ItemTitleBlock
              item={item}
              kind={kind}
              locationLine={locationLine}
              extraLines={extraLines}
              mapsUrl={mapsUrl}
              mapsEnabled={mapsEnabled}
            />
          </div>
        </div>
      </div>
    </article>
  );
}
