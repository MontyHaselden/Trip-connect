"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { tripLocalDateTime } from "@/lib/utils/time";
import type { ItineraryRowItem } from "@/lib/utils/itinerary-item-style";
import { ItineraryRow } from "./ItineraryRow";

function itemWindow(
  item: ItineraryRowItem,
  dateISO: string,
  tripTimezone: string,
) {
  return {
    start: tripLocalDateTime({
      dateISO,
      timeHHMMSS: item.startTime,
      tripTimezone,
    }),
    end: item.endTime
      ? tripLocalDateTime({
          dateISO,
          timeHHMMSS: item.endTime,
          tripTimezone,
        })
      : null,
  };
}

function pickFeaturedIndex(
  items: ItineraryRowItem[],
  dateISO: string,
  tripTimezone: string,
  isViewingToday: boolean,
): number {
  if (!items.length) return -1;
  if (!isViewingToday) return 0;

  const nowMs = Date.now();
  const withTimes = items.map((item, index) => ({
    index,
    ...itemWindow(item, dateISO, tripTimezone),
  }));

  const inProgress = withTimes.find((x) => {
    const started = x.start.toMillis() <= nowMs;
    const notEnded = !x.end || x.end.toMillis() >= nowMs;
    return started && notEnded;
  });
  if (inProgress) return inProgress.index;

  const upcoming = withTimes.find((x) => x.start.toMillis() > nowMs);
  if (upcoming) return upcoming.index;

  return withTimes[withTimes.length - 1]?.index ?? 0;
}

function featuredLabelForItem(
  item: ItineraryRowItem,
  dateISO: string,
  tripTimezone: string,
  isViewingToday: boolean,
): string {
  if (!isViewingToday) return "Up first";

  const nowMs = Date.now();
  const { start, end } = itemWindow(item, dateISO, tripTimezone);
  if (start.toMillis() > nowMs) return "Up first";

  const inProgress = start.toMillis() <= nowMs && (!end || end.toMillis() >= nowMs);
  return inProgress ? "Now" : "Up first";
}

export function ItineraryList(props: {
  items: ItineraryRowItem[];
  tripTimezone: string;
  dateISO: string;
  mapsOnline: boolean;
  isViewingToday: boolean;
  prepItems: Array<{ id: string; text: string }>;
}) {
  const { items, tripTimezone, dateISO, mapsOnline, isViewingToday, prepItems } =
    props;

  const scrollRef = useRef<HTMLDivElement>(null);
  const featuredRef = useRef<HTMLDivElement>(null);
  const [nowTick, setNowTick] = useState(0);

  useEffect(() => {
    if (!isViewingToday) return;
    const id = window.setInterval(() => setNowTick((t) => t + 1), 60_000);
    return () => window.clearInterval(id);
  }, [isViewingToday]);

  const featuredIndex = useMemo(
    () => pickFeaturedIndex(items, dateISO, tripTimezone, isViewingToday),
    [items, dateISO, tripTimezone, isViewingToday, nowTick],
  );

  const beforeItems = featuredIndex > 0 ? items.slice(0, featuredIndex) : [];
  const featuredItem = featuredIndex >= 0 ? items[featuredIndex] : null;
  const afterItems =
    featuredIndex >= 0 ? items.slice(featuredIndex + 1) : items;

  const featuredLabel = featuredItem
    ? featuredLabelForItem(featuredItem, dateISO, tripTimezone, isViewingToday)
    : "Up first";

  useEffect(() => {
    if (beforeItems.length === 0) return;

    const container = scrollRef.current;
    const featured = featuredRef.current;
    if (!container || !featured) return;

    const top = featured.offsetTop - 56;
    container.scrollTop = Math.max(0, top);
  }, [dateISO, featuredIndex, beforeItems.length]);

  if (!items.length && !prepItems.length) {
    return null;
  }

  return (
    <div
      ref={scrollRef}
      className="no-scrollbar min-h-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-y-contain [-webkit-overflow-scrolling:touch]"
    >
      {beforeItems.length ? (
        <section className="pb-2">
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-zinc-400">
            {isViewingToday ? "Earlier today" : "Before"}
          </p>
          {beforeItems.map((item, i) => (
            <ItineraryRow
              key={item.id}
              item={item}
              tripTimezone={tripTimezone}
              mapsEnabled={mapsOnline}
              isLast={i === beforeItems.length - 1}
            />
          ))}
        </section>
      ) : null}

      {featuredItem ? (
        <div
          ref={featuredRef}
          className="sticky top-0 z-10 bg-zinc-50/95 pb-3 backdrop-blur supports-[backdrop-filter]:bg-zinc-50/80"
        >
          <ItineraryRow
            item={featuredItem}
            tripTimezone={tripTimezone}
            mapsEnabled={mapsOnline}
            variant="featured"
            featuredLabel={featuredLabel}
          />
        </div>
      ) : null}

      {afterItems.length ? (
        <section className="mt-1 border-t border-zinc-100 pt-3">
          {afterItems.map((item, i) => (
            <ItineraryRow
              key={item.id}
              item={item}
              tripTimezone={tripTimezone}
              mapsEnabled={mapsOnline}
              isLast={i === afterItems.length - 1 && !prepItems.length}
            />
          ))}
        </section>
      ) : null}

      {prepItems.length ? (
        <section className="mt-6 border-t border-zinc-200/80 pt-5">
          <h2 className="text-xs font-medium uppercase tracking-wide text-zinc-500">
            Prep for tomorrow
          </h2>
          <ul className="mt-3 space-y-2 text-sm text-zinc-700">
            {prepItems.map((p) => (
              <li key={p.id} className="flex gap-2">
                <span className="text-zinc-400">·</span>
                <span>{p.text}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <div className="h-6 shrink-0" aria-hidden />
    </div>
  );
}
