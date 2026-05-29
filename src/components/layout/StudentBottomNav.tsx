"use client";

import { usePathname, useRouter } from "next/navigation";

import { useTripApp } from "./TripAppContext";
import { CalendarSheet } from "@/components/student/today/CalendarSheet";
import { tripDebug } from "@/lib/debug/trip-debug";

function NavItem(props: {
  href: string;
  label: string;
  active: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const { href, label, active } = props;

  return (
    <button
      type="button"
      onClick={() => {
        tripDebug("nav.click", { from: pathname, to: href, active });
        if (pathname !== href) {
          router.push(href);
        }
      }}
      className={[
        "flex flex-1 items-center justify-center rounded-xl px-3 py-2.5 text-sm font-medium",
        active ? "bg-zinc-900 text-white" : "text-zinc-700",
      ].join(" ")}
    >
      {label}
    </button>
  );
}

export function StudentBottomNav() {
  const pathname = usePathname();
  const { todayNav, calendarOpen, setCalendarOpen } = useTripApp();
  const onToday = pathname === "/app/today" || pathname.startsWith("/app/today/");
  const onMyTrip = pathname === "/app/my-trip";
  const showDayNav = onToday && todayNav !== null;

  return (
    <>
      <nav className="relative z-20 mt-auto shrink-0 bg-zinc-50 pb-[max(env(safe-area-inset-bottom),0px)]">
        <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm">
          {showDayNav ? (
            <div className="border-b border-zinc-100 px-2 py-2">
              <div className="grid grid-cols-[2.75rem_1fr_2.75rem] items-center gap-2">
                <button
                  type="button"
                  onClick={todayNav.goPrev}
                  disabled={!todayNav.canGoPrev}
                  aria-label="Previous day"
                  className="flex h-10 w-11 items-center justify-center rounded-xl border border-zinc-200 bg-zinc-50 text-xl font-light text-zinc-800 disabled:pointer-events-none disabled:opacity-30"
                >
                  ‹
                </button>

                <button
                  type="button"
                  onClick={() => setCalendarOpen(true)}
                  className="h-10 rounded-xl border border-zinc-200 bg-zinc-50 text-sm font-medium text-zinc-800"
                >
                  Calendar
                </button>

                <button
                  type="button"
                  onClick={todayNav.goNext}
                  disabled={!todayNav.canGoNext}
                  aria-label="Next day"
                  className="flex h-10 w-11 items-center justify-center rounded-xl border border-zinc-200 bg-zinc-50 text-xl font-light text-zinc-800 disabled:pointer-events-none disabled:opacity-30"
                >
                  ›
                </button>
              </div>
            </div>
          ) : null}

          <div className="flex gap-2 p-2">
            <NavItem href="/app/today" label="Today" active={onToday} />
            <NavItem href="/app/my-trip" label="My Trip" active={onMyTrip} />
          </div>
        </div>
      </nav>

      {showDayNav ? (
        <CalendarSheet
          open={calendarOpen}
          onClose={() => setCalendarOpen(false)}
          days={todayNav.scheduledDays}
          selectedDateISO={todayNav.selectedDateISO}
          onSelectDate={todayNav.setDate}
        />
      ) : null}
    </>
  );
}
