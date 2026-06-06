"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";

export function LegacyAppRedirect() {
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (!pathname.startsWith("/app/")) return;
    const tripId = localStorage.getItem("tc_trip_id");
    if (!tripId) return;
    if (pathname === "/app/settings") return;
    if (pathname === "/app/today" || pathname.startsWith("/app/today")) return;
    if (pathname === "/app/my-trip") return;
    if (pathname === "/app/calendar") return;
  }, [pathname, router]);

  return null;
}
