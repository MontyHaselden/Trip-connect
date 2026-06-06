"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

import { emptyTransportLeg } from "@/components/host/wizard/shared/TransportLegForm";
import { buildDefaultDayPlaces, syncIntercityLegs } from "@/lib/host/wizard/detect-city-moves";
import type { WizardWarning } from "@/lib/host/wizard/review-warnings";
import {
  emptyWizardDraft,
  type TripWizardDraft,
  type WizardStep,
} from "@/lib/host/wizard/types";

import { WizardShell } from "./WizardShell";
import { AccommodationStep } from "./steps/AccommodationStep";
import { ActivitiesStep } from "./steps/ActivitiesStep";
import { BasicsStep } from "./steps/BasicsStep";
import { DatesPlacesStep } from "./steps/DatesPlacesStep";
import { IntercityStep } from "./steps/IntercityStep";
import { MeetingsStep } from "./steps/MeetingsStep";
import { ReviewStep } from "./steps/ReviewStep";
import { TransportThereBackStep } from "./steps/TransportThereBackStep";

export function WizardClient({
  tripId,
  initialStep,
  initialTripName,
}: {
  tripId: string;
  initialStep: number;
  initialTripName: string;
}) {
  const router = useRouter();
  const [step, setStep] = useState<WizardStep>(initialStep as WizardStep);
  const [draft, setDraft] = useState<TripWizardDraft | null>(null);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<WizardWarning[]>([]);
  const [finishing, setFinishing] = useState(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSyncedName = useRef(initialTripName);

  const loadDraft = useCallback(async () => {
    const res = await fetch(`/api/trips/${tripId}/wizard-draft`);
    if (!res.ok) {
      setDraft(emptyWizardDraft(initialTripName));
      setLoading(false);
      return;
    }
    const body = await res.json();
    const loaded = body.draft as TripWizardDraft;
    if (!loaded.basics.name.trim()) {
      loaded.basics.name = initialTripName;
    }
    setDraft(loaded);
    lastSyncedName.current = loaded.basics.name.trim();
    if (body.currentStep) setStep(body.currentStep as WizardStep);
    setLoading(false);
  }, [tripId, initialTripName]);

  useEffect(() => {
    loadDraft();
  }, [loadDraft]);

  const persist = useCallback(
    async (nextDraft: TripWizardDraft, nextStep: WizardStep) => {
      setSaving(true);
      try {
        const res = await fetch(`/api/trips/${tripId}/wizard-draft`, {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ currentStep: nextStep, draft: nextDraft }),
        });
        if (res.ok) {
          const newName = nextDraft.basics.name.trim();
          if (newName && newName !== lastSyncedName.current) {
            lastSyncedName.current = newName;
            router.refresh();
          }
        }
      } finally {
        setSaving(false);
      }
    },
    [tripId, router],
  );

  const updateDraft = useCallback(
    (next: TripWizardDraft) => {
      setDraft(next);
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => {
        void persist(next, step);
      }, 600);
    },
    [persist, step],
  );

  async function loadWarnings() {
    const res = await fetch(`/api/trips/${tripId}/wizard/warnings`);
    if (res.ok) {
      const body = await res.json();
      setWarnings(body.warnings ?? []);
    }
  }

  useEffect(() => {
    if (step === 8) void loadWarnings();
  }, [step, tripId]);

  function prepareStepTransition(nextStep: WizardStep, current: TripWizardDraft) {
    let next = { ...current };

    if (step === 1 && nextStep === 2) {
      if (next.outboundLegs.length === 0) {
        next = {
          ...next,
          outboundLegs: [emptyTransportLeg(next.basics.startDate)],
          returnLegs: [emptyTransportLeg(next.basics.endDate)],
        };
      }
      if (next.dayPlaces.length === 0 && next.basics.startDate && next.basics.endDate) {
        next = {
          ...next,
          dayPlaces: buildDefaultDayPlaces(
            next.basics.startDate,
            next.basics.endDate,
            next.basics.departureCity,
            next.basics.returnCity,
          ),
        };
      }
    }

    if (step === 3 && nextStep === 4) {
      // accommodation auto-filled in step component
    }

    if (step === 4 && nextStep === 5) {
      next = {
        ...next,
        intercityLegs: syncIntercityLegs(next.dayPlaces, next.intercityLegs),
      };
    }

    return next;
  }

  async function goNext() {
    if (!draft || step >= 8) return;
    const nextStep = (step + 1) as WizardStep;
    let nextDraft = prepareStepTransition(nextStep, draft);

    if (step === 5 && nextStep === 6) {
      setSaving(true);
      try {
        await persist(nextDraft, nextStep);
        const res = await fetch(`/api/trips/${tripId}/wizard/commit-shell`, {
          method: "POST",
        });
        if (!res.ok) throw new Error("Failed to build itinerary shell");
        nextDraft = { ...nextDraft, shellCommitted: true };
      } catch (err) {
        setError(err instanceof Error ? err.message : "Shell commit failed");
        setSaving(false);
        return;
      }
      setSaving(false);
    }

    setDraft(nextDraft);
    setStep(nextStep);
    router.replace(`/dashboard/trips/${tripId}/wizard?step=${nextStep}`);
    void persist(nextDraft, nextStep);
  }

  function goBack() {
    if (step <= 1) return;
    const prev = (step - 1) as WizardStep;
    setStep(prev);
    router.replace(`/dashboard/trips/${tripId}/wizard?step=${prev}`);
    if (draft) void persist(draft, prev);
  }

  function goToStep(s: number) {
    const target = Math.min(8, Math.max(1, s)) as WizardStep;
    setStep(target);
    router.replace(`/dashboard/trips/${tripId}/wizard?step=${target}`);
    if (draft) void persist(draft, target);
  }

  async function finishSetup() {
    if (!draft) return;
    setFinishing(true);
    setError(null);
    try {
      await persist(draft, 8);
      const res = await fetch(`/api/trips/${tripId}/wizard/finish`, { method: "POST" });
      if (!res.ok) throw new Error("Failed to finish setup");
      router.push(`/dashboard/trips/${tripId}/builder`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Finish failed");
    } finally {
      setFinishing(false);
    }
  }

  if (loading || !draft) {
    return <p className="px-5 py-10 text-sm text-zinc-600">Loading wizard…</p>;
  }

  return (
    <>
      {error ? <p className="mx-auto max-w-3xl px-5 pt-4 text-sm text-red-700">{error}</p> : null}
      <WizardShell
        currentStep={step}
        saving={saving}
        onBack={step > 1 ? goBack : undefined}
        onNext={step < 8 ? goNext : undefined}
        nextLabel={step === 5 ? "Build shell & continue" : step === 7 ? "Review" : "Continue"}
      >
        {step === 1 ? <BasicsStep draft={draft} onChange={updateDraft} /> : null}
        {step === 2 ? <TransportThereBackStep draft={draft} onChange={updateDraft} /> : null}
        {step === 3 ? <DatesPlacesStep draft={draft} onChange={updateDraft} /> : null}
        {step === 4 ? <AccommodationStep draft={draft} onChange={updateDraft} /> : null}
        {step === 5 ? <IntercityStep draft={draft} onChange={updateDraft} /> : null}
        {step === 6 ? <ActivitiesStep draft={draft} onChange={updateDraft} /> : null}
        {step === 7 ? <MeetingsStep draft={draft} onChange={updateDraft} /> : null}
        {step === 8 ? (
          <ReviewStep
            draft={draft}
            warnings={warnings}
            onGoToStep={goToStep}
            onFinish={finishSetup}
            onGoToBuilder={() => router.push(`/dashboard/trips/${tripId}/builder`)}
            finishing={finishing}
          />
        ) : null}
      </WizardShell>
    </>
  );
}
