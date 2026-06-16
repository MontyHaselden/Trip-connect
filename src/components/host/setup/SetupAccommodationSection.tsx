"use client";

import { useMemo, useState } from "react";

import { AccommodationStayForm } from "@/components/host/wizard/shared/AccommodationStayForm";
import {
  applySetupAccommodationChange,
} from "@/lib/host/setup/apply-setup-accommodation";
import { coalesceAdjacentNamedStays } from "@/lib/host/setup/accommodation-calendar";
import {
  groupAccommodationStays,
  mainAccommodationStays,
  mergeAccommodationStays,
} from "@/lib/host/setup/entity-scope";
import { accommodationStatusItems } from "@/lib/host/setup/section-status-items";
import type { TripSetupState } from "@/lib/host/setup/types";
import type { AccommodationStayDraft } from "@/lib/host/wizard/types";
import { newId } from "@/lib/host/wizard/types";

import { PropagateChangeModal, type PropagateScope } from "./PropagateChangeModal";
import { SetupAddsPanel } from "./SetupAddsPanel";
import { SetupSectionSplit } from "./SetupSectionSplit";
import { SetupSectionStatusPanel } from "./SetupSectionStatusPanel";

export function SetupAccommodationSection(props: {
  tripId: string;
  inviteCode: string;
  state: TripSetupState;
  activeGroupId: string;
  sectionLabel?: string;
  sectionMessage?: string;
  onChange: (next: TripSetupState) => void;
  onSave: (next: TripSetupState, scope?: PropagateScope) => void | Promise<void>;
  saving: boolean;
}) {
  const { state, activeGroupId, sectionLabel, sectionMessage, onChange, onSave, saving } = props;
  const isMain = activeGroupId === state.mainGroupId;
  const [propagateOpen, setPropagateOpen] = useState(false);

  const visibleStays = useMemo(
    () =>
      coalesceAdjacentNamedStays(
        isMain
          ? mainAccommodationStays(state)
          : groupAccommodationStays(state, activeGroupId),
      ),
    [state, isMain, activeGroupId],
  );

  const inheritedMainStays = isMain
    ? []
    : mainAccommodationStays(state).filter(
        (s) =>
          !visibleStays.some(
            (g) => g.checkInDate < s.checkOutDate && g.checkOutDate > s.checkInDate,
          ),
      );

  const statusItems = useMemo(
    () => accommodationStatusItems(state, activeGroupId),
    [state, activeGroupId],
  );

  function updateStay(index: number, updated: AccommodationStayDraft) {
    const stays = [...visibleStays];
    stays[index] = {
      ...updated,
      originGroupId: isMain ? state.mainGroupId : activeGroupId,
    };
    onChange({
      ...state,
      accommodationStays: isMain
        ? mergeAccommodationStays(state, state.mainGroupId, stays)
        : mergeAccommodationStays(state, activeGroupId, stays),
    });
  }

  function removeStay(index: number) {
    const stays = visibleStays.filter((_, i) => i !== index);
    const withStays = {
      ...state,
      accommodationStays: isMain
        ? mergeAccommodationStays(state, state.mainGroupId, stays)
        : mergeAccommodationStays(state, activeGroupId, stays),
    };
    onChange(applySetupAccommodationChange(withStays, activeGroupId));
  }

  function addStay() {
    const dayPlaces = state.dayPlacesByGroupId[activeGroupId] ?? [];
    const firstCity = dayPlaces.find((d) => d.primaryCity.trim())?.primaryCity ?? "TBC";
    const stay: AccommodationStayDraft = {
      id: newId(),
      cityLabel: firstCity,
      stayType: "hotel",
      name: null,
      url: null,
      address: null,
      phone: null,
      checkInDate: state.basics.startDate,
      checkOutDate: state.basics.endDate,
      notes: null,
      isHomestayGroup: false,
      multipleInCity: false,
      originGroupId: isMain ? state.mainGroupId : activeGroupId,
    };
    onChange({
      ...state,
      accommodationStays: [...state.accommodationStays, stay],
    });
  }

  function hasLinkedCopies(): boolean {
    return visibleStays.some((v) =>
      state.accommodationStays.some((other) => other.sourceEntityId === v.id),
    );
  }

  function buildSavedState(): TripSetupState {
    return applySetupAccommodationChange(state, activeGroupId);
  }

  function commitSave(scope?: PropagateScope) {
    const next = buildSavedState();
    onChange(next);
    void onSave(next, scope);
  }

  function handleSaveClick() {
    if (isMain && state.groups.some((g) => !g.isMain) && hasLinkedCopies()) {
      setPropagateOpen(true);
      return;
    }
    commitSave();
  }

  function stayTitle(stay: AccommodationStayDraft): string {
    return stay.name?.trim() || stay.cityLabel || "Accommodation";
  }

  return (
    <SetupSectionSplit
      status={
        <SetupSectionStatusPanel
          section={
            sectionLabel
              ? { id: "accommodation", label: sectionLabel, status: "todo", message: sectionMessage }
              : undefined
          }
          items={statusItems}
        />
      }
      adds={
        <SetupAddsPanel>
          <div className="space-y-6">
            {!isMain && inheritedMainStays.length ? (
              <section className="space-y-2">
                <h3 className="text-sm font-semibold text-zinc-500">Inherited from Main Group</h3>
                {inheritedMainStays.map((stay) => (
                  <div
                    key={stay.id}
                    className="rounded-lg border border-dashed border-zinc-200 bg-white p-3 text-sm text-zinc-600"
                  >
                    {stayTitle(stay)} ({stay.checkInDate} – {stay.checkOutDate})
                  </div>
                ))}
              </section>
            ) : null}

            <section className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-zinc-900">
                  {isMain ? "Accommodation stays" : "Group accommodation"}
                </h3>
                <button
                  type="button"
                  onClick={addStay}
                  className="text-sm font-medium text-sky-800"
                >
                  + Add stay
                </button>
              </div>
              {visibleStays.length === 0 ? (
                <p className="text-sm text-zinc-500">No stays for this group yet.</p>
              ) : (
                visibleStays.map((stay, i) => (
                  <div key={stay.id} className="space-y-3 rounded-xl border border-zinc-200 bg-white p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h4 className="font-medium">{stayTitle(stay)}</h4>
                        <p className="text-xs text-zinc-500">
                          {stay.checkInDate} – {stay.checkOutDate}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeStay(i)}
                        className="shrink-0 rounded-lg px-2 py-1 text-xs font-medium text-zinc-500 hover:bg-zinc-100 hover:text-red-700"
                        aria-label={`Remove ${stayTitle(stay)}`}
                      >
                        Remove
                      </button>
                    </div>
                    <AccommodationStayForm
                      embedded
                      stay={stay}
                      onChange={(updated) => updateStay(i, updated)}
                      countryNames={state.basics.destinationCountries}
                      cityHint={stay.cityLabel}
                    />
                  </div>
                ))
              )}
            </section>

            <button
              type="button"
              disabled={saving}
              onClick={handleSaveClick}
              className="h-10 w-full rounded-lg bg-zinc-900 text-sm font-medium text-white disabled:opacity-50"
            >
              {saving ? "Saving…" : "Save accommodation"}
            </button>
          </div>

          <PropagateChangeModal
            open={propagateOpen}
            groupNames={state.groups.filter((g) => !g.isMain).map((g) => g.name)}
            onClose={() => setPropagateOpen(false)}
            onConfirm={(scope) => {
              setPropagateOpen(false);
              commitSave(scope);
            }}
          />
        </SetupAddsPanel>
      }
    />
  );
}
