"use client";

import { TripSectionShell, TripSoftPanel } from "../shared/TripSectionShell";

export function IngestDisabledPanel(props: { onGoToActivities?: () => void }) {
  return (
    <TripSectionShell
      eyebrow="Ingestion"
      title="AI / Import"
      description="Temporarily unavailable while we improve it."
      fill
    >
      <TripSoftPanel>
        <div className="space-y-4 py-4 text-sm leading-relaxed text-zinc-600">
          <p>
            The trip assistant isn&apos;t reliable enough yet — we&apos;ve turned it off for now so
            it doesn&apos;t get in the way of planning.
          </p>
          <p>
            Add activities, stays, and transport directly from the calendar and section tabs on the
            left. That&apos;s the supported workflow today.
          </p>
          {props.onGoToActivities ? (
            <button
              type="button"
              onClick={props.onGoToActivities}
              className="rounded-full bg-violet-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-violet-700"
            >
              Go to Activities
            </button>
          ) : null}
        </div>
      </TripSoftPanel>
    </TripSectionShell>
  );
}
