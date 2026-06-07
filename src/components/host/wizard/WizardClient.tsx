"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";

import { emptyTransportLeg } from "@/lib/host/wizard/leg-chain";
import { syncIntercityFromDraft } from "@/lib/host/wizard/detect-city-moves";
import { applyTransportToDraft } from "@/lib/host/wizard/derive-trip-dates";
import { hasUncoveredTripDays } from "@/lib/host/wizard/location-stays";
import { buildTripDayCoverageContext } from "@/lib/host/wizard/transport-day-placement";
import {
  confirmLaterProgressRisk,
  draftChangedSince,
  hasLaterWizardProgress,
  snapshotDraft,
} from "@/lib/host/wizard/wizard-progress";
import {
  emptyWizardDraft,
  WIZARD_LAST_STEP,
  type TripWizardDraft,
  type WizardStep,
} from "@/lib/host/wizard/types";

import { WizardShell } from "./WizardShell";
import { AccommodationStep } from "./steps/AccommodationStep";
import { BasicsStep } from "./steps/BasicsStep";
import { BetweenCityTravelStep } from "./steps/BetweenCityTravelStep";
import { DatesPlacesStep } from "./steps/DatesPlacesStep";
import { TransportThereBackStep } from "./steps/TransportThereBackStep";

function scrollPageToTop() {
  window.scrollTo(0, 0);
}

function isCalendarWizardStep(step: WizardStep): boolean {
  return step === 3 || step === 4 || step === 5;
}

function wizardStepHref(tripId: string, wizardStep: WizardStep): string {
  return `/dashboard/trips/${tripId}/wizard?step=${wizardStep}`;
}

function datesPlacesReady(draft: TripWizardDraft): boolean {
  const { startDate, endDate, departureCity, returnCity } = draft.basics;
  if (!startDate || !endDate) return false;
  const trip = { startDate, endDate, departureCity, returnCity };
  return !hasUncoveredTripDays(
    draft.dayPlaces,
    startDate,
    endDate,
    buildTripDayCoverageContext(draft, trip, { includeIntercity: false }),
  );
}

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
  const [finishing, setFinishing] = useState(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSyncedName = useRef(initialTripName);
  const stepEntryDraft = useRef("");
  const furthestStep = useRef<WizardStep>(initialStep as WizardStep);

  const loadDraft = useCallback(async () => {
    const res = await fetch(`/api/trips/${tripId}/wizard-draft`);
    if (!res.ok) {
      setDraft(emptyWizardDraft(initialTripName));
      setLoading(false);
      return;
    }
    const body = await res.json();
    let loaded = body.draft as TripWizardDraft;
    if (!loaded.basics.name.trim()) {
      loaded.basics.name = initialTripName;
    }
    if (typeof loaded.datesPlacesConfirmed !== "boolean") {
      loaded.datesPlacesConfirmed = false;
    }
    loaded = applyTransportToDraft(loaded);
    if (loaded.wizardFinished) {
      setLoading(false);
      router.replace(`/dashboard/trips/${tripId}/builder`);
      return;
    }
    if (loaded.shellCommitted && body.currentStep > WIZARD_LAST_STEP) {
      setLoading(false);
      try {
        await fetch(`/api/trips/${tripId}/wizard/finish`, { method: "POST" });
      } catch {
        /* best-effort — builder page will retry finish if needed */
      }
      router.replace(`/dashboard/trips/${tripId}/builder`);
      return;
    }
    setDraft(loaded);
    lastSyncedName.current = loaded.basics.name.trim();
    if (body.currentStep) {
      const loadedStep = Math.min(
        WIZARD_LAST_STEP,
        Math.max(1, Number(body.currentStep) || 1),
      ) as WizardStep;
      setStep(loadedStep);
      furthestStep.current = Math.max(furthestStep.current, loadedStep) as WizardStep;
    }
    stepEntryDraft.current = snapshotDraft(loaded);
    setLoading(false);
  }, [tripId, initialTripName, router]);

  useEffect(() => {
    loadDraft();
  }, [loadDraft]);

  useLayoutEffect(() => {
    if (isCalendarWizardStep(step)) return;
    scrollPageToTop();
  }, [step]);

  useLayoutEffect(() => {
    if (!draft) return;
    stepEntryDraft.current = snapshotDraft(draft);
  }, [step]);

  useEffect(() => {
    if (step > furthestStep.current) {
      furthestStep.current = step;
    }
  }, [step]);

  useEffect(() => {
    if (!draft || loading) return;
    if (step > 3 && !datesPlacesReady(draft) && !draft.datesPlacesConfirmed) {
      const fallback = 3 as WizardStep;
      setStep(fallback);
      scrollPageToTop();
      router.replace(wizardStepHref(tripId, fallback), { scroll: false });
    }
  }, [draft, loading, step, tripId, router]);

  const persist = useCallback(
    async (
      nextDraft: TripWizardDraft,
      nextStep: WizardStep,
      options?: { manageSaving?: boolean },
    ) => {
      const manageSaving = options?.manageSaving !== false;
      if (manageSaving) setSaving(true);
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
        if (manageSaving) setSaving(false);
      }
    },
    [tripId, router],
  );

  const flushSave = useCallback(
    async (
      nextDraft: TripWizardDraft,
      stepToSave: WizardStep = step,
      options?: { manageSaving?: boolean },
    ) => {
      if (saveTimer.current) {
        clearTimeout(saveTimer.current);
        saveTimer.current = null;
      }
      await persist(nextDraft, stepToSave, options);
    },
    [persist, step],
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

  function shouldWarnOnContinue(current: TripWizardDraft): boolean {
    if (step === 3) return false;
    if (furthestStep.current <= step) return false;
    if (!hasLaterWizardProgress(current)) return false;
    return draftChangedSince(stepEntryDraft.current, current);
  }

  async function completeSetupAndOpenBuilder(current: TripWizardDraft) {
    await flushSave(current, WIZARD_LAST_STEP, { manageSaving: false });
    await persist(current, WIZARD_LAST_STEP, { manageSaving: false });
    const res = await fetch(`/api/trips/${tripId}/wizard/finish`, { method: "POST" });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(
        typeof body.error === "string" ? body.error : "Failed to open trip preview",
      );
    }
    setDraft({ ...current, shellCommitted: true, wizardFinished: true });
    router.push(`/dashboard/trips/${tripId}/builder`);
  }

  async function goNext() {
    if (!draft || saving || finishing) return;
    if (step === 3 && !datesPlacesReady(draft)) return;

    if (step === WIZARD_LAST_STEP) {
      if (shouldWarnOnContinue(draft) && !confirmLaterProgressRisk()) return;
      setFinishing(true);
      setSaving(true);
      setError(null);
      try {
        await completeSetupAndOpenBuilder(draft);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not open trip preview");
      } finally {
        setSaving(false);
        setFinishing(false);
      }
      return;
    }

    if (shouldWarnOnContinue(draft) && !confirmLaterProgressRisk()) return;

    setSaving(true);
    setError(null);
    try {
      await flushSave(draft, step, { manageSaving: false });

      const nextStep = (step + 1) as WizardStep;
      const nextDraft = prepareStepTransition(nextStep, draft);

      if (!isCalendarWizardStep(step) || !isCalendarWizardStep(nextStep)) {
        scrollPageToTop();
      }
      setDraft(nextDraft);
      setStep(nextStep);
      router.replace(wizardStepHref(tripId, nextStep), { scroll: false });
      void persist(nextDraft, nextStep, { manageSaving: false });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not continue");
    } finally {
      setSaving(false);
    }
  }

  function prepareStepTransition(nextStep: WizardStep, current: TripWizardDraft) {
    let next = { ...current };

    if (step === 1 && nextStep === 2) {
      if (next.outboundLegs.length === 0) {
        next = {
          ...next,
          outboundLegs: [emptyTransportLeg()],
          returnLegs: [emptyTransportLeg()],
        };
      }
    }

    if (step === 2 && nextStep === 3) {
      next = applyTransportToDraft(next);
    }

    if (step === 3 && nextStep === 4) {
      next = {
        ...next,
        intercityLegs: syncIntercityFromDraft(next),
        datesPlacesConfirmed: true,
      };
    }

    return next;
  }

  function canAccessStep(target: WizardStep): boolean {
    if (!draft) return false;
    if (target <= 3) return true;
    return datesPlacesReady(draft) || draft.datesPlacesConfirmed;
  }

  async function goBack() {
    if (step <= 1 || !draft) return;
    await flushSave(draft, step);
    const prev = (step - 1) as WizardStep;
    if (!isCalendarWizardStep(step) || !isCalendarWizardStep(prev)) {
      scrollPageToTop();
    }
    setStep(prev);
    router.replace(wizardStepHref(tripId, prev), { scroll: false });
    void persist(draft, prev);
  }

  async function goToStep(s: number) {
    if (!draft) return;
    const target = Math.min(WIZARD_LAST_STEP, Math.max(1, s)) as WizardStep;
    if (!canAccessStep(target)) return;
    await flushSave(draft, step);
    if (!isCalendarWizardStep(step) || !isCalendarWizardStep(target)) {
      scrollPageToTop();
    }
    setStep(target);
    router.replace(wizardStepHref(tripId, target), { scroll: false });
    void persist(draft, target);
  }

  if (loading || !draft) {
    return <p className="px-5 py-10 text-sm text-zinc-600">Loading wizard…</p>;
  }

  const step3Blocked = step === 3 && !datesPlacesReady(draft);
  const calendarStepNav = step === 3 || step === 4 || step === 5;

  const savingMessage =
    finishing || (saving && step === WIZARD_LAST_STEP)
      ? "Opening trip preview…"
      : saving
        ? "Saving…"
        : null;

  return (
    <>
      {error ? <p className="mx-auto max-w-3xl px-5 pt-4 text-sm text-red-700">{error}</p> : null}
      <WizardShell
        currentStep={step}
        saving={saving || finishing}
        savingMessage={savingMessage}
        wide={calendarStepNav}
        hideFooterNav={calendarStepNav}
        onBack={calendarStepNav ? undefined : step > 1 ? goBack : undefined}
        onNext={calendarStepNav ? undefined : step < WIZARD_LAST_STEP ? goNext : undefined}
        nextDisabled={step3Blocked}
      >
        {step === 1 ? <BasicsStep draft={draft} onChange={updateDraft} /> : null}
        {step === 2 ? <TransportThereBackStep draft={draft} onChange={updateDraft} /> : null}
        {step === 3 ? (
          <DatesPlacesStep
            draft={draft}
            onChange={updateDraft}
            onBack={goBack}
            onContinue={goNext}
            continueDisabled={step3Blocked}
            saving={saving}
          />
        ) : null}
        {step === 4 ? (
          <BetweenCityTravelStep
            draft={draft}
            onChange={updateDraft}
            onBack={goBack}
            onContinue={goNext}
            saving={saving}
          />
        ) : null}
        {step === 5 ? (
          <AccommodationStep
            draft={draft}
            onChange={updateDraft}
            onBack={goBack}
            onContinue={goNext}
            saving={saving || finishing}
          />
        ) : null}
      </WizardShell>
    </>
  );
}
