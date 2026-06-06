"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function LegacyCalendarRedirect() {
  const router = useRouter();
  useEffect(() => {
    const tripId = localStorage.getItem("tc_trip_id");
    if (tripId) router.replace(`/trip/${tripId}/today`);
    else router.replace("/");
  }, [router]);
  return null;
}
