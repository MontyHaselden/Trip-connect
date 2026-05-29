"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

export function AiImportProgress(props: {
  inviteCode: string;
  dayCount: number;
  onReload: () => Promise<void>;
  onError: (msg: string) => void;
}) {
  const { inviteCode, dayCount, onReload, onError } = props;
  const searchParams = useSearchParams();
  const router = useRouter();
  const building = searchParams.get("building") === "1";

  const [active, setActive] = useState(building);
  const [timedOut, setTimedOut] = useState(false);

  useEffect(() => {
    if (!building) return;

    setActive(true);
    const started = Date.now();
    const maxMs = 4 * 60 * 1000;

    const interval = window.setInterval(async () => {
      try {
        await onReload();
      } catch (err) {
        onError(err instanceof Error ? err.message : "Failed to refresh itinerary");
      }

      if (Date.now() - started > maxMs) {
        window.clearInterval(interval);
        setTimedOut(true);
        setActive(false);
      }
    }, 3000);

    return () => window.clearInterval(interval);
  }, [building, onReload, onError]);

  useEffect(() => {
    if (!active || dayCount === 0) return;

    setActive(false);
    setTimedOut(false);
    router.replace(`/host/${encodeURIComponent(inviteCode)}/manage/itinerary`);
  }, [active, dayCount, inviteCode, router]);

  if (!active && !timedOut) return null;

  if (timedOut && dayCount === 0) {
    return (
      <section className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
        AI is taking longer than expected. Try refreshing this page, or use Import
        from text to paste your itinerary manually.
      </section>
    );
  }

  return (
    <section className="rounded-2xl border border-sky-200 bg-sky-50 px-4 py-4 text-sm text-sky-950">
      <p className="font-medium">AI is building your itinerary…</p>
      <p className="mt-1">
        {dayCount > 0
          ? `${dayCount} day${dayCount === 1 ? "" : "s"} added so far. More may still be loading.`
          : "This usually takes 30–90 seconds. Days and activities will appear here as they are created."}
      </p>
    </section>
  );
}
