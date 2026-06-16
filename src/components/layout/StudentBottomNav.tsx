"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import { DateTime } from "luxon";

import { useTripApp } from "@/components/layout/TripAppContext";
import { tripDebug } from "@/lib/debug/trip-debug";
import {
  studentAppMyTripPath,
  studentAppPath,
  studentTripMyTripPath,
  studentTripTodayPath,
} from "@/lib/mobile/trip-storage";
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
        "relative flex flex-1 items-center justify-center rounded-full px-3 py-2.5 text-sm font-semibold transition-colors",
        active
          ? "bg-[var(--student-nav)] text-white"
          : "text-[var(--student-text-muted)]",
      ].join(" ")}
    >
      {label}
      {reminder ? (
        <span
          className="absolute right-3 top-1.5 flex h-2 w-2 rounded-full bg-[var(--student-accent)] ring-2 ring-[var(--student-bg)]"
          aria-label="Photos needed for this day"
        />
      ) : null}
    </a>
  );
}

function parseStudentRoute(pathname: string): {
  inviteCode?: string;
  tripId?: string;
} {
  const studentMatch = pathname.match(/^\/s\/([^/]+)/);
  if (studentMatch) {
    return { inviteCode: decodeURIComponent(studentMatch[1]) };
  }
  const tripMatch = pathname.match(/^\/trip\/([^/]+)/);
  if (tripMatch) {
    return { tripId: decodeURIComponent(tripMatch[1]) };
  }
  return {};
}

export function StudentBottomNav(props: { inviteCode?: string; preview?: boolean }) {
  const pathname = usePathname();
  const { cache, todayNav, participantPhotos } = useTripApp();
  const route = parseStudentRoute(pathname);
  const inviteCode = props.inviteCode ?? route.inviteCode;
  const tripId = route.tripId ?? cache.tripId;

  const todayBase = inviteCode
    ? studentAppPath(inviteCode)
    : tripId
      ? studentTripTodayPath(tripId)
      : null;
  const myTripHref = inviteCode
    ? studentAppMyTripPath(inviteCode)
    : tripId
      ? studentTripMyTripPath(tripId)
      : null;

  const [todayHref, setTodayHref] = useState(todayBase ?? "/");

  const trip = useMemo(
    () => resolveStudentTripPayload(cache.payload, cache.participantId),
    [cache.payload, cache.participantId],
  );

  const onToday =
    Boolean(todayBase) &&
    (pathname === todayBase ||
      pathname.startsWith(`${todayBase}?`) ||
      (tripId !== null &&
        (pathname === studentTripTodayPath(tripId) ||
          pathname.startsWith(`${studentTripTodayPath(tripId)}?`))));

  const onMyTrip =
    Boolean(myTripHref) &&
    (pathname === myTripHref ||
      (tripId !== null && pathname === studentTripMyTripPath(tripId)));

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
    if (!todayBase) return;
    if (
      pathname.includes("/today") ||
      pathname === todayBase ||
      pathname.startsWith(`${todayBase}?`)
    ) {
      const search = typeof window !== "undefined" ? window.location.search : "";
      setTodayHref(search ? `${todayBase}${search}` : todayBase);
      return;
    }
    try {
      const lastDate = sessionStorage.getItem("tc_last_date");
      if (lastDate) {
        setTodayHref(`${todayBase}?date=${encodeURIComponent(lastDate)}`);
        return;
      }
    } catch {
      // ignore
    }
    setTodayHref(todayBase);
  }, [pathname, todayBase]);

  if (!todayBase || !myTripHref) return null;

  if (props.preview) {
    return (
      <nav className="relative z-20 mt-auto shrink-0 border-t border-[var(--student-line)] bg-[var(--student-bg)] pb-[max(env(safe-area-inset-bottom),0px)] pt-2">
        <div className="flex items-center gap-1 rounded-full bg-[var(--student-surface)] p-1 shadow-sm ring-1 ring-[var(--student-line)]/80">
          <span className="relative flex flex-1 items-center justify-center rounded-full bg-[var(--student-nav)] px-3 py-2.5 text-sm font-semibold text-white">
            Today
          </span>
          <span className="relative flex flex-1 items-center justify-center rounded-full px-3 py-2.5 text-sm font-semibold text-[var(--student-text-muted)]">
            My Trip
          </span>
        </div>
      </nav>
    );
  }

  return (
    <nav className="relative z-20 mt-auto shrink-0 border-t border-[var(--student-line)] bg-[var(--student-bg)] pb-[max(env(safe-area-inset-bottom),0px)] pt-2">
      <div className="flex items-center gap-1 rounded-full bg-[var(--student-surface)] p-1 shadow-sm ring-1 ring-[var(--student-line)]/80">
        <NavItem href={todayHref} label="Today" active={onToday} />
        <NavItem
          href={myTripHref}
          label="My Trip"
          active={onMyTrip}
          reminder={myTripPhotoReminder && !onMyTrip}
        />
      </div>
    </nav>
  );
}
