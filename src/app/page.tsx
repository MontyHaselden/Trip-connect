"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { enterTripAppClient } from "@/lib/client/enter-trip-app";

export default function Home() {
  const router = useRouter();
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function route() {
      const tripId = localStorage.getItem("tc_trip_id");
      const token = localStorage.getItem("tc_access_token");
      if (tripId && token) {
        router.replace("/app/today");
        return;
      }

      try {
        const sessionRes = await fetch("/api/host/me");
        if (sessionRes.ok) {
          const session = (await sessionRes.json()) as {
            activeTripId?: string | null;
          };
          const tripsRes = await fetch("/api/host/trips");
          if (tripsRes.ok) {
            const body = (await tripsRes.json()) as {
              trips: Array<{ id: string; inviteCode: string }>;
            };
            const trips = body.trips ?? [];
            const active =
              trips.find((t) => t.id === session.activeTripId) ?? trips[0];
            if (active) {
              await enterTripAppClient(active.inviteCode);
              if (!cancelled) router.replace("/app/today");
              return;
            }
          }
        }
      } catch {
        // fall through to landing
      }

      if (!cancelled) setChecking(false);
    }

    route();
    return () => {
      cancelled = true;
    };
  }, [router]);

  if (checking) {
    return (
      <main className="min-h-dvh bg-zinc-50 px-5 py-10 text-zinc-900">
        <div className="mx-auto flex w-full max-w-md flex-col gap-5">
          <p className="text-sm text-zinc-600">Loading…</p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-dvh bg-zinc-50 px-5 py-10 text-zinc-900">
      <div className="mx-auto flex w-full max-w-md flex-col gap-5">
        <header className="flex flex-col gap-2">
          <h1 className="text-2xl font-semibold tracking-tight">Trip Connect</h1>
          <p className="text-sm text-zinc-600">
            Your trip companion — hosts, teachers, and students.
          </p>
        </header>

        <div className="rounded-2xl border border-zinc-200 bg-white p-5">
          <p className="text-sm text-zinc-700">
            Hosts and teachers sign in to manage trips. Students join with an invite
            link.
          </p>
          <a
            href="/host"
            className="mt-4 inline-flex h-11 w-full items-center justify-center rounded-xl bg-zinc-900 px-4 text-sm font-medium text-white"
          >
            Host portal
          </a>
          <p className="mt-3 text-xs text-zinc-600">
            Students join using an invite link:{" "}
            <span className="font-mono">/join/abc123</span>
          </p>
        </div>
      </div>
    </main>
  );
}
