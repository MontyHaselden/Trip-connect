"use client";

import { useEffect, useMemo, useState } from "react";

export type ChatThinkingMode = "trip" | "import";

type ThinkingStep = { afterMs: number; label: string };

const TRIP_STEPS: ThinkingStep[] = [
  { afterMs: 0, label: "Reading your message…" },
  { afterMs: 2500, label: "Checking the calendar…" },
  { afterMs: 8000, label: "Planning changes…" },
  { afterMs: 20000, label: "Still working…" },
];

const IMPORT_STEPS: ThinkingStep[] = [
  { afterMs: 0, label: "Sending your message…" },
  { afterMs: 1200, label: "Reading itinerary text…" },
  { afterMs: 4000, label: "Extracting dates, cities, and activities…" },
  { afterMs: 10000, label: "Checking what's ready to import…" },
  { afterMs: 25000, label: "Still reading — long documents take longer…" },
];

function activeStep(steps: ThinkingStep[], elapsedMs: number): { label: string; index: number } {
  let index = 0;
  for (let i = 0; i < steps.length; i += 1) {
    if (elapsedMs >= steps[i]!.afterMs) index = i;
  }
  return { label: steps[index]!.label, index };
}

export function useChatThinkingStatus(active: boolean, mode: ChatThinkingMode | null) {
  const [elapsedMs, setElapsedMs] = useState(0);

  useEffect(() => {
    if (!active || !mode) {
      setElapsedMs(0);
      return;
    }
    const started = Date.now();
    const tick = () => setElapsedMs(Date.now() - started);
    tick();
    const id = window.setInterval(tick, 400);
    return () => clearInterval(id);
  }, [active, mode]);

  const steps = mode === "import" ? IMPORT_STEPS : TRIP_STEPS;

  return useMemo(() => {
    const { label, index } = activeStep(steps, elapsedMs);
    const elapsedSec = Math.max(1, Math.round(elapsedMs / 1000));
    const slow = elapsedMs >= 45000;
    return {
      label,
      stepIndex: index,
      stepCount: steps.length,
      elapsedSec,
      slow,
    };
  }, [elapsedMs, steps]);
}
