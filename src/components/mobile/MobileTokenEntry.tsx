"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import { InstallGate } from "@/components/mobile/InstallGate";
import { saveTripSession } from "@/lib/mobile/trip-storage";

type TripMeta = {
  tripId: string;
  tripName: string;
  inviteCode: string;
};

export function MobileTokenEntry(props: {
  token: string;
  purpose: "host_admin" | "host_trip";
  startUrl: string;
}) {
  const { token, purpose, startUrl } = props;
  const router = useRouter();
  const [tripMeta, setTripMeta] = useState<TripMeta | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [exchanging, setExchanging] = useState(false);

  const exchange = useCallback(async () => {
    if (exchanging) return;
    setExchanging(true);
    setError(null);
    try {
      const res = await fetch("/api/mobile/exchange", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ token }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || "Link expired or invalid.");

      if (body.purpose === "host_trip") {
        const inviteCode = body.inviteCode || tripMeta?.inviteCode;
        if (!inviteCode) throw new Error("Missing trip context.");
        saveTripSession({
          tripId: body.tripId,
          participantId: body.participantId,
          accessToken: body.accessToken,
          inviteCode,
        });
      }

      router.replace(body.redirectTo);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not open link.");
      setExchanging(false);
    }
  }, [token, tripMeta?.inviteCode, router, exchanging]);

  useEffect(() => {
    fetch(`/api/mobile/token-meta?token=${encodeURIComponent(token)}`)
      .then((r) => r.json())
      .then((body) => {
        if (body.tripId) setTripMeta(body);
      })
      .catch(() => null);
  }, [token]);

  const tripName = tripMeta?.tripName ?? "Trip Connect";
  const manifestHref = `/api/manifest?name=${encodeURIComponent(tripName)}&startUrl=${encodeURIComponent(startUrl)}`;

  return (
    <InstallGate
      tripName={purpose === "host_admin" ? `${tripName} Admin` : tripName}
      manifestHref={manifestHref}
      onReady={() => void exchange()}
    >
      <div className="flex min-h-dvh items-center justify-center p-6">
        <p className="text-sm text-zinc-600">
          {exchanging ? "Signing you in…" : "Opening…"}
        </p>
        {error ? <p className="mt-2 text-sm text-red-700">{error}</p> : null}
      </div>
    </InstallGate>
  );
}
