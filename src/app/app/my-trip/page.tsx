"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function LegacyMyTripRedirect() {
  const router = useRouter();
  useEffect(() => {
    const tripId = localStorage.getItem("tc_trip_id");
    if (tripId) router.replace(`/trip/${tripId}/my-trip`);
    else router.replace("/");
  }, [router]);
  return <p className="p-6 text-center text-sm text-zinc-600">Redirecting…</p>;
}
