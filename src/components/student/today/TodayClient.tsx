"use client";

import { Suspense, useMemo, useState } from "react";

import { useTripCache } from "@/hooks/useTripCache";
import { useSelectedTripDay } from "@/hooks/useSelectedTripDay";
import type { ParticipantFilteredTripV1 } from "@/lib/publish/filter-for-participant";
import { buildMapsSearchUrl } from "@/lib/utils/maps";
import {
  formatRelativeFromNow,
  formatTripDateHeader,
  formatTripTime,
  getCountdownToStart,
  tripLocalDateTime,
} from "@/lib/utils/time";
import { TripNotReady } from "@/components/student/TripNotReady";
import { CalendarSheet } from "@/components/student/today/CalendarSheet";
import { TodayBuildingBanner } from "@/components/student/today/TodayBuildingBanner";

function isTripPayload(x: unknown): x is ParticipantFilteredTripV1 {
  if (!x || typeof x !== "object") return false;
  const o = x as { trip?: unknown; days?: unknown; itineraryItems?: unknown };
  return Boolean(o.trip && o.days && o.itineraryItems);
}

function TodayContent() {
  const cache = useTripCache();
  const trip = isTripPayload(cache.payload) ? cache.payload : null;
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const tripNotPublished =
    cache.version === 0 ||
    (cache.version === null &&
      !trip &&
      (cache.status === "up_to_date" || cache.status === "ready"));

  const tripTz = trip?.trip.timezone ?? "UTC";
  const tripDates = trip
    ? { startDate: trip.trip.startDate, endDate: trip.trip.endDate }
    : undefined;

  const {
    selectedDay,
    phase,
    tripEve,
    firstDay,
    goToday,
    goTomorrow,
    goNext,
    setDate,
    viewDay1,
  } = useSelectedTripDay(trip?.days ?? [], tripTz, tripDates);

  const countdown = useMemo(() => {
    if (!trip || phase !== "pre") return null;
    return getCountdownToStart({
      startDate: trip.trip.startDate,
      tripTimezone: tripTz,
    });
  }, [phase, trip, tripTz]);

  const dayItems = useMemo(() => {
    if (!trip || !selectedDay) return [];
    return trip.itineraryItems
      .filter((i) => i.tripDayId === selectedDay.id)
      .sort((a, b) => a.sortOrder - b.sortOrder);
  }, [trip, selectedDay]);

  const nextUp = useMemo(() => {
    if (!trip || !selectedDay) return null;
    const nowMs = Date.now();

    const upcoming = dayItems
      .map((i) => ({
        item: i,
        start: tripLocalDateTime({
          dateISO: selectedDay.date,
          timeHHMMSS: i.startTime,
          tripTimezone: tripTz,
        }),
      }))
      .filter((x) => x.start.toMillis() >= nowMs - 2 * 60 * 1000)
      .sort((a, b) => a.start.toMillis() - b.start.toMillis())[0];

    if (!upcoming) return null;

    const leaveBy = upcoming.item.leaveByTime
      ? tripLocalDateTime({
          dateISO: selectedDay.date,
          timeHHMMSS: upcoming.item.leaveByTime,
          tripTimezone: tripTz,
        })
      : null;

    return { ...upcoming, leaveBy };
  }, [dayItems, selectedDay, trip, tripTz]);

  const tomorrowPrep = useMemo(() => {
    if (!trip || !selectedDay) return [];
    return trip.tomorrowPrepItems
      .filter((p) => p.tripDayId === selectedDay.id)
      .sort((a, b) => a.sortOrder - b.sortOrder);
  }, [trip, selectedDay]);

  const evePrep = useMemo(() => {
    if (!trip || !firstDay || !tripEve || selectedDay) return [];
    return trip.tomorrowPrepItems
      .filter((p) => p.tripDayId === firstDay.id)
      .sort((a, b) => a.sortOrder - b.sortOrder);
  }, [firstDay, selectedDay, trip, tripEve]);

  async function onRefresh() {
    setRefreshing(true);
    try {
      await cache.refresh();
    } finally {
      setRefreshing(false);
    }
  }

  if (cache.status === "offline_no_cache") {
    return (
      <main className="flex flex-col gap-4 py-2">
        <h2 className="text-2xl font-semibold tracking-tight">Today</h2>
        <div className="rounded-2xl border border-zinc-200 bg-white p-5">
          <p className="text-sm text-zinc-700">
            Connect to the internet once to download the trip.
          </p>
        </div>
      </main>
    );
  }

  if (tripNotPublished && !trip) {
    return (
      <>
        <Suspense>
          <TodayBuildingBanner />
        </Suspense>
        <TripNotReady
          title="Today"
          onRefresh={cache.online ? onRefresh : undefined}
          refreshing={refreshing}
        />
      </>
    );
  }

  if (!trip) {
    return (
      <main className="flex flex-col gap-4 py-2">
        <Suspense>
          <TodayBuildingBanner />
        </Suspense>
        <h2 className="text-2xl font-semibold tracking-tight">Today</h2>
        <div className="rounded-2xl border border-zinc-200 bg-white p-5">
          <p className="text-sm text-zinc-700">Loading trip…</p>
        </div>
      </main>
    );
  }

  if (phase === "pre" && !selectedDay) {
    return (
      <main className="flex flex-col gap-4 py-2">
        <Suspense>
          <TodayBuildingBanner />
        </Suspense>
        <header className="flex flex-col gap-1">
          <h2 className="text-2xl font-semibold tracking-tight">Today</h2>
          <p className="text-sm text-zinc-600">{trip.trip.name}</p>
        </header>

        {countdown ? (
          <section className="rounded-2xl border border-zinc-200 bg-white p-5">
            <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
              Countdown
            </p>
            <p className="mt-2 text-xl font-semibold text-zinc-900">
              {countdown.label}
            </p>
            {!tripEve && countdown.days > 0 ? (
              <p className="mt-1 text-sm text-zinc-600">
                {countdown.days} day{countdown.days === 1 ? "" : "s"},{" "}
                {countdown.hours} hour{countdown.hours === 1 ? "" : "s"} to go
              </p>
            ) : null}
          </section>
        ) : null}

        <section className="rounded-2xl border border-zinc-200 bg-white p-5">
          <h3 className="text-base font-semibold">Trip summary</h3>
          <dl className="mt-3 space-y-2 text-sm">
            <div>
              <dt className="text-xs text-zinc-500">Dates</dt>
              <dd className="font-medium">
                {trip.trip.startDate} → {trip.trip.endDate}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-zinc-500">School</dt>
              <dd className="font-medium">{trip.trip.schoolName}</dd>
            </div>
            {trip.trip.destinationCountry ? (
              <div>
                <dt className="text-xs text-zinc-500">Destination</dt>
                <dd className="font-medium">{trip.trip.destinationCountry}</dd>
              </div>
            ) : null}
          </dl>
        </section>

        {tripEve && firstDay ? (
          <>
            {evePrep.length ? (
              <section className="rounded-2xl border border-zinc-200 bg-white p-5">
                <h3 className="text-base font-semibold">
                  Pack for Day 1 (tomorrow)
                </h3>
                <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-zinc-800">
                  {evePrep.map((p) => (
                    <li key={p.id}>{p.text}</li>
                  ))}
                </ul>
              </section>
            ) : null}
            <button
              type="button"
              onClick={viewDay1}
              className="inline-flex h-11 w-full items-center justify-center rounded-xl bg-zinc-900 px-4 text-sm font-medium text-white"
            >
              View Day 1
            </button>
          </>
        ) : null}
      </main>
    );
  }

  if (!selectedDay) {
    return (
      <main className="flex flex-col gap-4 py-2">
        <h2 className="text-2xl font-semibold tracking-tight">Today</h2>
        <div className="rounded-2xl border border-zinc-200 bg-white p-5">
          <p className="text-sm text-zinc-700">No days in this trip yet.</p>
        </div>
      </main>
    );
  }

  const tomorrowLabel =
    phase === "pre" && tripEve ? "Day 1" : "Tomorrow";

  return (
    <main className="flex flex-col gap-4 py-2">
      <Suspense>
        <TodayBuildingBanner />
      </Suspense>
      <header className="flex flex-col gap-1">
        <h2 className="text-2xl font-semibold tracking-tight">Today</h2>
        <p className="text-sm text-zinc-600">
          {formatTripDateHeader({ dateISO: selectedDay.date, tripTimezone: tripTz })}{" "}
          — {selectedDay.cityLabel}
        </p>
      </header>

      <div className="flex gap-2">
        <button
          type="button"
          onClick={goToday}
          className="h-10 flex-1 rounded-xl border border-zinc-200 bg-white text-sm font-medium"
        >
          Today
        </button>
        <button
          type="button"
          onClick={goTomorrow}
          className="h-10 flex-1 rounded-xl border border-zinc-200 bg-white text-sm font-medium"
        >
          {tomorrowLabel}
        </button>
        <button
          type="button"
          onClick={goNext}
          className="h-10 flex-1 rounded-xl border border-zinc-200 bg-white text-sm font-medium"
        >
          Next day
        </button>
        <button
          type="button"
          onClick={() => setCalendarOpen(true)}
          className="h-10 flex-1 rounded-xl border border-zinc-200 bg-white text-sm font-medium"
        >
          Calendar
        </button>
      </div>

      <section className="rounded-2xl border border-zinc-200 bg-white p-5">
        <h3 className="text-base font-semibold">Next up</h3>
        {nextUp ? (
          <div className="mt-3">
            <div className="text-sm text-zinc-900">
              <span className="font-medium">
                {formatTripTime(nextUp.item.startTime, tripTz)}
              </span>
              <span className="text-zinc-500"> — </span>
              <span className="font-medium">{nextUp.item.title}</span>
            </div>
            <div className="mt-2 text-xs text-zinc-600">
              Starts {formatRelativeFromNow(nextUp.start)}.
            </div>
            {nextUp.leaveBy ? (
              <div className="mt-1 text-xs text-zinc-600">
                Leave by {formatTripTime(nextUp.item.leaveByTime!, tripTz)} (
                {formatRelativeFromNow(nextUp.leaveBy)})
              </div>
            ) : null}
            {nextUp.item.bringNote ? (
              <div className="mt-3 text-sm text-zinc-700">
                <span className="font-medium">Bring:</span> {nextUp.item.bringNote}
              </div>
            ) : null}
            {nextUp.item.transportNote ? (
              <div className="mt-2 text-sm text-zinc-700">
                <span className="font-medium">Transport:</span>{" "}
                {nextUp.item.transportNote}
              </div>
            ) : null}
          </div>
        ) : (
          <p className="mt-2 text-sm text-zinc-700">No more items today.</p>
        )}
      </section>

      <section className="rounded-2xl border border-zinc-200 bg-white p-5">
        <h3 className="text-base font-semibold">Timeline</h3>
        <div className="mt-3 flex flex-col gap-3">
          {dayItems.map((item) => {
            const mapsQuery = item.mapQuery || item.address || "";
            const mapsUrl = mapsQuery ? buildMapsSearchUrl(mapsQuery) : null;
            return (
              <div
                key={item.id}
                className="rounded-xl border border-zinc-200 bg-white p-4"
              >
                <div className="flex items-baseline justify-between gap-3">
                  <div className="text-sm font-semibold">
                    {formatTripTime(item.startTime, tripTz)}
                    {item.endTime ? `–${formatTripTime(item.endTime, tripTz)}` : ""}
                  </div>
                </div>
                <div className="mt-1 text-sm font-medium text-zinc-900">
                  {item.title}
                </div>
                {item.locationName ? (
                  <div className="mt-1 text-sm text-zinc-700">{item.locationName}</div>
                ) : null}
                {item.address ? (
                  <div className="mt-1 text-sm text-zinc-700">{item.address}</div>
                ) : null}
                <div className="mt-3 flex gap-2">
                  <a
                    href={mapsUrl ?? "#"}
                    target="_blank"
                    rel="noreferrer"
                    aria-disabled={!cache.online || !mapsUrl}
                    className={[
                      "inline-flex h-10 flex-1 items-center justify-center rounded-xl border border-zinc-200 bg-white text-sm font-medium",
                      !cache.online || !mapsUrl ? "pointer-events-none opacity-50" : "",
                    ].join(" ")}
                  >
                    Open in Maps
                  </a>
                </div>
                {item.leaveByTime ? (
                  <div className="mt-3 text-sm text-zinc-700">
                    <span className="font-medium">Leave by:</span>{" "}
                    {formatTripTime(item.leaveByTime, tripTz)}
                  </div>
                ) : null}
                {item.transportNote ? (
                  <div className="mt-2 text-sm text-zinc-700">
                    <span className="font-medium">Transport:</span> {item.transportNote}
                  </div>
                ) : null}
                {item.bringNote ? (
                  <div className="mt-2 text-sm text-zinc-700">
                    <span className="font-medium">Bring:</span> {item.bringNote}
                  </div>
                ) : null}
                {item.hostNote ? (
                  <div className="mt-2 text-sm text-zinc-700">
                    <span className="font-medium">Note:</span> {item.hostNote}
                  </div>
                ) : null}
              </div>
            );
          })}
          {dayItems.length === 0 ? (
            <p className="text-sm text-zinc-700">No itinerary items for this day.</p>
          ) : null}
        </div>
      </section>

      <section className="rounded-2xl border border-zinc-200 bg-white p-5">
        <h3 className="text-base font-semibold">Tomorrow prep</h3>
        {tomorrowPrep.length ? (
          <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-zinc-800">
            {tomorrowPrep.map((p) => (
              <li key={p.id}>{p.text}</li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-sm text-zinc-700">No prep notes yet.</p>
        )}
      </section>

      <CalendarSheet
        open={calendarOpen}
        onClose={() => setCalendarOpen(false)}
        days={trip.days}
        selectedDateISO={selectedDay.date}
        onSelectDate={(d) => {
          setDate(d);
          setCalendarOpen(false);
        }}
      />
    </main>
  );
}

export function TodayClient() {
  return (
    <Suspense>
      <TodayContent />
    </Suspense>
  );
}
