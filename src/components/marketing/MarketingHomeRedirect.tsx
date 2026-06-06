"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

import { enterTripAppClient } from "@/lib/client/enter-trip-app";

export function MarketingHomeRedirect() {
  const router = useRouter();

  useEffect(() => {
    let cancelled = false;

    async function route() {
      const tripId = localStorage.getItem("tc_trip_id");
      const token = localStorage.getItem("tc_access_token");
      if (tripId && token) {
        router.replace(`/trip/${tripId}/today`);
        return;
      }

      try {
        const sessionRes = await fetch("/api/host/me");
        if (sessionRes.ok) {
          const tripsRes = await fetch("/api/host/trips");
          if (tripsRes.ok) {
            const body = (await tripsRes.json()) as {
              trips: Array<{ id: string; inviteCode: string }>;
            };
            const trips = body.trips ?? [];
            if (trips[0]) {
              await enterTripAppClient(trips[0].inviteCode);
              if (!cancelled) router.replace(`/trip/${trips[0].id}/today`);
              return;
            }
            if (!cancelled) router.replace("/dashboard");
            return;
          }
        }
      } catch {
        // show landing
      }
    }

    route();
    return () => {
      cancelled = true;
    };
  }, [router]);

  return null;
}
