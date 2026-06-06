"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

import { tripDebug } from "@/lib/debug/trip-debug";

function NavItem(props: { href: string; label: string; active: boolean }) {
  const pathname = usePathname();
  const { href, label, active } = props;

  return (
    <a
      href={href}
      onClick={() => {
        tripDebug("nav.click", { from: pathname, to: href, active, mode: "hard" });
      }}
      className={[
        "flex flex-1 items-center justify-center rounded-lg px-2 py-2 text-sm font-medium",
        active ? "bg-zinc-900 text-white" : "text-zinc-700",
      ].join(" ")}
    >
      {label}
    </a>
  );
}

function extractTripId(pathname: string): string | null {
  const m = pathname.match(/^\/trip\/([^/]+)/);
  return m?.[1] ?? null;
}

export function StudentBottomNav() {
  const pathname = usePathname();
  const tripId = extractTripId(pathname);
  const [todayHref, setTodayHref] = useState(tripId ? `/trip/${tripId}/today` : "/");

  const onToday =
    Boolean(tripId) &&
    (pathname === `/trip/${tripId}/today` || pathname.startsWith(`/trip/${tripId}/today`));
  const onMyTrip = Boolean(tripId) && pathname === `/trip/${tripId}/my-trip`;

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
        <div className="flex gap-1 p-1.5">
          <NavItem href={todayHref} label="Today" active={onToday} />
          <NavItem href={`/trip/${tripId}/my-trip`} label="My Trip" active={onMyTrip} />
        </div>
      </div>
    </nav>
  );
}
