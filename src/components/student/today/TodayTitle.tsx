"use client";

import { formatTripDateHeader, daysUntilTrip } from "@/lib/utils/time";

export function TodayTitle(props: {
  tripName: string;
  schoolName: string;
  dateISO: string;
  cityLabel: string;
  tripTimezone: string;
  tripStartDate?: string;
}) {
  const { tripName, schoolName, dateISO, cityLabel, tripTimezone, tripStartDate } =
    props;

  const dateLine = formatTripDateHeader({ dateISO, tripTimezone });
  const beforeTrip =
    tripStartDate &&
    dateISO < tripStartDate &&
    daysUntilTrip({ startDate: tripStartDate, dateISO, tripTimezone });

  return (
    <header className="shrink-0 border-b border-zinc-200/80 pb-4 pt-1">
      <p className="text-[11px] font-medium uppercase tracking-widest text-zinc-500">
        {schoolName}
      </p>
      <h1 className="mt-1 text-2xl font-bold leading-tight tracking-tight text-zinc-900">
        {tripName}
      </h1>
      <p className="mt-2 text-lg font-semibold text-zinc-800">{dateLine}</p>
      {cityLabel ? (
        <p className="mt-0.5 text-sm text-zinc-600">{cityLabel}</p>
      ) : null}
      {typeof beforeTrip === "number" && beforeTrip > 0 ? (
        <p className="mt-1 text-xs text-zinc-500">
          {beforeTrip} day{beforeTrip === 1 ? "" : "s"} until trip
        </p>
      ) : null}
    </header>
  );
}
