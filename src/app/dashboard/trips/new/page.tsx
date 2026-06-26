"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { createTripShellClient } from "@/lib/trip-os/create-trip-client";
import { tripOsHomePath, tripOsSetupPath } from "@/lib/trip-os/paths";

/** Direct visits only — client effects do not run on Link prefetch. */
export default function NewTripPage() {
  const router = useRouter();
  const startedRef = useRef(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;

    void (async () => {
      const result = await createTripShellClient();
      if (result.ok) {
        router.replace(tripOsSetupPath(result.tripId));
        return;
      }
      setError(result.error);
    })();
  }, [router]);

  if (error) {
    return (
      <main className="flex min-h-dvh flex-col items-center justify-center gap-3 bg-white px-6 text-center">
        <p className="text-sm text-red-600">{error}</p>
        <button
          type="button"
          onClick={() => router.replace(tripOsHomePath())}
          className="rounded-full border border-zinc-200 px-4 py-2 text-sm text-zinc-700 hover:bg-zinc-50"
        >
          Back to trips
        </button>
      </main>
    );
  }

  return (
    <main className="flex min-h-dvh items-center justify-center bg-white px-6">
      <p className="text-sm text-zinc-500">Creating trip…</p>
    </main>
  );
}
