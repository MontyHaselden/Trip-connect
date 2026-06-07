"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import { DateTime } from "luxon";

import { useTripApp } from "@/components/layout/TripAppContext";
import { tripDebug } from "@/lib/debug/trip-debug";
import { dayNeedsPhotoReminder } from "@/lib/student/participant-photos";
import { resolveStudentTripPayload } from "@/lib/student/resolve-trip-payload";

function NavItem(props: {
  href: string;
  label: string;
  active: boolean;
  reminder?: boolean;
}) {
  const pathname = usePathname();
  const { href, label, active, reminder } = props;

  return (
    <a
      href={href}
      onClick={() => {
        tripDebug("nav.click", { from: pathname, to: href, active, mode: "hard" });
      }}
      className={[
        "relative flex flex-1 items-center justify-center rounded-lg px-2 py-2 text-sm font-medium",
        active ? "bg-zinc-900 text-white" : "text-zinc-700",
      ].join(" ")}
    >
      {label}
      {reminder ? (
        <span
          className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-amber-500 text-[10px] font-bold leading-none text-white"
          aria-label="Photos needed for this day"
        >
          !
        </span>
      ) : null}
    </a>
  );
}

function extractTripId(pathname: string): string | null {
  const m = pathname.match(/^\/trip\/([^/]+)/);
  return m?.[1] ?? null;
}

export function StudentBottomNav() {
  const pathname = usePathname();
  const { cache, todayNav, participantPhotos } = useTripApp();
  const tripId = extractTripId(pathname);
  const [todayHref, setTodayHref] = useState(tripId ? `/trip/${tripId}/today` : "/");

  const trip = useMemo(
    () => resolveStudentTripPayload(cache.payload, cache.participantId),
    [cache.payload, cache.participantId],
  );

  const onToday =
    Boolean(tripId) &&
    (pathname === `/trip/${tripId}/today` || pathname.startsWith(`/trip/${tripId}/today`));
  const onMyTrip = Boolean(tripId) && pathname === `/trip/${tripId}/my-trip`;

  const myTripPhotoReminder = useMemo(() => {
    if (!todayNav || !trip) return false;
    const day = todayNav.scheduledDays.find(
      (d) => d.date === todayNav.selectedDateISO,
    );
    if (!day) return false;
    const todayISO = DateTime.now().setZone(trip.trip.timezone).toISODate();
    return dayNeedsPhotoReminder(
      participantPhotos,
      day.id,
      day.date,
      todayISO,
    );
  }, [todayNav, trip, participantPhotos]);

  useEffect(() => {
    if (!tripId) return;
    if (pathname.includes("/today") && typeof window !== "undefined") {
      const search = window.location.search;
      setTodayHref(search ? `/trip/${tripId}/today${search}` : `/trip/${tripId}/today`);
      return;
    }
    try {
      const lastDate = sessionStorage.getItem("tc_last_date");
      if (lastDate) {
        setTodayHref(`/trip/${tripId}/today?date=${encodeURIComponent(lastDate)}`);
        return;
      }
    } catch {
      // ignore
    }
    setTodayHref(`/trip/${tripId}/today`);
  }, [pathname, tripId]);

  if (!tripId) return null;

  return (
    <nav className="relative z-20 mt-auto shrink-0 bg-zinc-50 pb-[max(env(safe-area-inset-bottom),0px)]">
      <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm">
        <div className="flex items-center gap-1 p-1.5">
          <NavItem href={todayHref} label="Today" active={onToday} />
          <NavItem
            href={`/trip/${tripId}/my-trip`}
            label="My Trip"
            active={onMyTrip}
            reminder={myTripPhotoReminder && !onMyTrip}
          />
        </div>
      </div>
    </nav>
  );
}
