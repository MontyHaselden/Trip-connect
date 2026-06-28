"use client";

import { useMemo } from "react";
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
  label: string;
  active: boolean;
  reminder?: boolean;
  onClick: () => void;
}) {
  const { label, active, reminder, onClick } = props;

  return (
    <button
      type="button"
      onClick={onClick}
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
    </button>
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

export type StudentEmbeddedTab = "today" | "my-trip";

export function StudentBottomNav(props: {
  inviteCode?: string;
  preview?: boolean;
  embeddedTab?: StudentEmbeddedTab;
  onEmbeddedTabChange?: (tab: StudentEmbeddedTab) => void;
}) {
  const pathname = usePathname();
  const { cache, todayNav, participantPhotos, studentTab, setStudentTab } = useTripApp();
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

  const trip = useMemo(
    () => resolveStudentTripPayload(cache.payload, cache.participantId),
    [cache.payload, cache.participantId],
  );

  const onToday = studentTab === "today";
  const onMyTrip = studentTab === "my-trip";

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

  if (!todayBase || !myTripHref) return null;

  function switchTab(tab: StudentEmbeddedTab) {
    tripDebug("nav.click", { from: pathname, to: tab, mode: "instant" });
    setStudentTab(tab);
  }

  if (props.preview) {
    const embeddedTab = props.embeddedTab ?? studentTab;
    const onTabChange = props.onEmbeddedTabChange ?? setStudentTab;

    return (
      <nav className="relative z-20 mt-auto shrink-0 border-t border-[var(--student-line)] bg-[var(--student-bg)] pb-[max(env(safe-area-inset-bottom),0px)] pt-2">
        <div className="flex items-center gap-1 rounded-full bg-[var(--student-surface)] p-1 shadow-sm ring-1 ring-[var(--student-line)]/80">
          <button
            type="button"
            onClick={() => onTabChange("today")}
            className={[
              "relative flex flex-1 items-center justify-center rounded-full px-3 py-2.5 text-sm font-semibold transition-colors",
              embeddedTab === "today"
                ? "bg-[var(--student-nav)] text-white"
                : "text-[var(--student-text-muted)]",
            ].join(" ")}
          >
            Today
          </button>
          <button
            type="button"
            onClick={() => onTabChange("my-trip")}
            className={[
              "relative flex flex-1 items-center justify-center rounded-full px-3 py-2.5 text-sm font-semibold transition-colors",
              embeddedTab === "my-trip"
                ? "bg-[var(--student-nav)] text-white"
                : "text-[var(--student-text-muted)]",
            ].join(" ")}
          >
            My Trip
          </button>
        </div>
      </nav>
    );
  }

  return (
    <nav className="relative z-20 mt-auto shrink-0 border-t border-[var(--student-line)] bg-[var(--student-bg)] pb-[max(env(safe-area-inset-bottom),0px)] pt-2">
      <div className="flex items-center gap-1 rounded-full bg-[var(--student-surface)] p-1 shadow-sm ring-1 ring-[var(--student-line)]/80">
        <NavItem label="Today" active={onToday} onClick={() => switchTab("today")} />
        <NavItem
          label="My Trip"
          active={onMyTrip}
          reminder={myTripPhotoReminder && !onMyTrip}
          onClick={() => switchTab("my-trip")}
        />
      </div>
    </nav>
  );
}
