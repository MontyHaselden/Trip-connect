"use client";

import type { WizardWarning } from "@/lib/host/wizard/review-warnings";
import type { TripWizardDraft } from "@/lib/host/wizard/types";

import { WarningList } from "../shared/WarningList";

export function ReviewStep({
  draft,
  warnings,
  onGoToStep,
  onFinish,
  onGoToBuilder,
  finishing,
}: {
  draft: TripWizardDraft;
  warnings: WizardWarning[];
  onGoToStep: (step: number) => void;
  onFinish: () => void;
  onGoToBuilder: () => void;
  finishing: boolean;
}) {
  const { basics } = draft;

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold">Review</h2>

      <section className="space-y-2 text-sm">
        <h3 className="font-medium">Trip basics</h3>
        <p>
          {basics.name} · {basics.schoolName}
        </p>
        <p>
          {basics.startDate} – {basics.endDate} · {basics.timezone}
        </p>
        <p>
          {basics.departureCity} → {basics.destinationCountries.join(", ")} →{" "}
          {basics.returnCity}
        </p>
      </section>

      <section className="grid gap-2 text-sm sm:grid-cols-2">
        <div className="rounded-lg bg-zinc-50 p-3">
          <p className="font-medium">Outbound legs</p>
          <p className="text-zinc-600">{draft.outboundLegs.length}</p>
        </div>
        <div className="rounded-lg bg-zinc-50 p-3">
          <p className="font-medium">Return legs</p>
          <p className="text-zinc-600">{draft.returnLegs.length}</p>
        </div>
        <div className="rounded-lg bg-zinc-50 p-3">
          <p className="font-medium">Days with places</p>
          <p className="text-zinc-600">
            {draft.dayPlaces.filter((d) => d.primaryCity.trim()).length} / {draft.dayPlaces.length}
          </p>
        </div>
        <div className="rounded-lg bg-zinc-50 p-3">
          <p className="font-medium">Accommodation stays</p>
          <p className="text-zinc-600">{draft.accommodationStays.length}</p>
        </div>
        <div className="rounded-lg bg-zinc-50 p-3">
          <p className="font-medium">Inter-city transport</p>
          <p className="text-zinc-600">{draft.intercityLegs.length}</p>
        </div>
        <div className="rounded-lg bg-zinc-50 p-3">
          <p className="font-medium">Activities</p>
          <p className="text-zinc-600">{draft.activities.length}</p>
        </div>
        <div className="rounded-lg bg-zinc-50 p-3">
          <p className="font-medium">Pre-trip meetings</p>
          <p className="text-zinc-600">{draft.meetings.length}</p>
        </div>
      </section>

      <section>
        <h3 className="mb-2 font-medium text-sm">Warnings</h3>
        <WarningList warnings={warnings} onGoToStep={onGoToStep} />
      </section>

      <div className="flex flex-col gap-2 sm:flex-row">
        <button
          type="button"
          disabled={finishing}
          onClick={onFinish}
          className="h-11 flex-1 rounded-xl bg-zinc-900 text-sm font-medium text-white disabled:opacity-50"
        >
          {finishing ? "Finishing…" : "Finish setup"}
        </button>
        <button
          type="button"
          onClick={onGoToBuilder}
          className="h-11 flex-1 rounded-xl border border-zinc-300 text-sm font-medium"
        >
          Go to dashboard
        </button>
      </div>
    </div>
  );
}
