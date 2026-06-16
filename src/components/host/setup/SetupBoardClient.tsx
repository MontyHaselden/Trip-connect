"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

import { AiChatPanel } from "@/components/host/builder/AiChatPanel";
import { removeGroupFromSetupState } from "@/lib/host/setup/setup-draft-storage";
import { dedupeCityChangeLegs } from "@/lib/host/setup/dedupe-intercity-legs";
import { mainAccommodationStays } from "@/lib/host/setup/entity-scope";
import { resolvedMainDayPlaces } from "@/lib/host/setup/resolved-day-places";
import { syncTripBoundsFromContent } from "@/lib/host/setup/sync-trip-bounds";
import { tripNameNeedsAttention } from "@/lib/host/setup/trip-naming";
import type { NightBoundary } from "@/lib/host/setup/stay-boundaries";
import { cityOnHalf, type HalfSide } from "@/lib/host/wizard/location-stays";
import type { SetupSectionId, SetupSectionReadiness, TripSetupState } from "@/lib/host/setup/types";

import type { PropagateScope } from "./PropagateChangeModal";
import { propagateMainEntitiesAfterSave } from "@/lib/host/setup/propagate-after-save";

import { BookingsSection } from "./BookingsSection";
import { SetupAccommodationSection } from "./SetupAccommodationSection";
import { SetupLocationsSection } from "./SetupLocationsSection";
import { SetupActivitiesSection } from "./SetupActivitiesSection";
import { SetupOverviewSection } from "./SetupOverviewSection";
import { SetupDayContextPanel } from "./SetupDayContextPanel";
import { SetupGroupsSection } from "./SetupGroupsSection";
import { SetupMiddleWorkspace } from "./SetupMiddleWorkspace";
import { SetupParticipantsSection } from "./SetupParticipantsSection";
import { SetupPersistentCalendar } from "./SetupPersistentCalendar";
import { SetupPlaceholderSection } from "./SetupPlaceholderSection";
import { SetupSectionNav } from "./SetupSectionNav";
import { SetupTransportSection } from "./SetupTransportSection";
import type { TransportFlightFocus } from "./SetupPlanesPanel";
import { TransportMoveWarningModal } from "./TransportMoveWarningModal";
import { useSetupCalendar } from "./use-setup-calendar";

type MiddleView = "empty" | "day" | "section";

function initialSection(): SetupSectionId {
  return "overview";
}

function normalizeSetupState(state: TripSetupState): TripSetupState {
  const named = mainAccommodationStays(state).filter((s) => s.name?.trim());
  const dayPlaces = resolvedMainDayPlaces(state);
  return syncTripBoundsFromContent({
    ...state,
    intercityLegs: dedupeCityChangeLegs(state.intercityLegs, named, dayPlaces),
  });
}

function sectionMeta(
  sections: SetupSectionReadiness[],
  id: SetupSectionId,
): { label?: string; message?: string } {
  const match = sections.find((s) => s.id === id);
  return { label: match?.label, message: match?.message };
}

export function SetupBoardClient(props: {
  tripId: string;
  inviteCode: string;
  timezone: string;
  aiBuilderEnabled: boolean;
}) {
  const { tripId, inviteCode, timezone, aiBuilderEnabled } = props;
  const [state, setState] = useState<TripSetupState | null>(null);
  const [sections, setSections] = useState<SetupSectionReadiness[]>([]);
  const [activeSection, setActiveSection] = useState<SetupSectionId>("overview");
  const [activeGroupId, setActiveGroupId] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [aiOpen, setAiOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [nameFocused, setNameFocused] = useState(false);
  const [sectionInitialized, setSectionInitialized] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch(`/api/trips/${tripId}/setup`);
    const body = await res.json();
    if (!res.ok) throw new Error(body.error || "Failed to load setup");
    const serverState = body.state as TripSetupState;
    setState(normalizeSetupState(serverState));
    setActiveGroupId(serverState.mainGroupId);
    if (!sectionInitialized) {
      setActiveSection(initialSection());
      setSectionInitialized(true);
    }
  }, [tripId, sectionInitialized]);

  const loadReadiness = useCallback(async () => {
    const res = await fetch(`/api/trips/${tripId}/setup/readiness`);
    const body = await res.json();
    if (res.ok) setSections(body.sections ?? []);
  }, [tripId]);

  useEffect(() => {
    load()
      .then(() => loadReadiness())
      .catch((e) => setError(e instanceof Error ? e.message : "Load failed"))
      .finally(() => setLoading(false));
  }, [load, loadReadiness]);

  async function saveState(
    next?: TripSetupState,
    propagateScope?: PropagateScope,
  ): Promise<boolean> {
    const raw = next ?? state;
    if (!raw) return false;
    const payload = syncTripBoundsFromContent(raw);
    if (tripNameNeedsAttention(payload.basics.name)) {
      setError("Give this trip a real name before saving.");
      return false;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/trips/${tripId}/setup`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          state: payload,
          activeGroupId,
          skipWizardItineraryItems: true,
        }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || "Save failed");
      setState(payload);
      if (propagateScope && propagateScope !== "main_only") {
        await propagateMainEntitiesAfterSave(tripId, payload, propagateScope);
      }
      await loadReadiness();
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
      return false;
    } finally {
      setSaving(false);
    }
  }

  async function createGroup(name: string, type: string) {
    const res = await fetch(`/api/trips/${tripId}/setup/groups`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name, type }),
    });
    const body = await res.json();
    if (!res.ok) throw new Error(body.error || "Could not create group");
    await load();
    if (body.group?.id) setActiveGroupId(body.group.id);
  }

  async function deleteGroup(groupId: string) {
    const res = await fetch(`/api/trips/${tripId}/setup/groups/${groupId}`, {
      method: "DELETE",
    });
    const body = (await res.json().catch(() => ({}))) as { error?: string };

    if (res.status === 404) {
      setState((current) => {
        if (!current) return current;
        return removeGroupFromSetupState(current, groupId);
      });
      if (activeGroupId === groupId) setActiveGroupId("");
      return;
    }

    if (!res.ok) throw new Error(body.error || "Could not delete group");
    if (activeGroupId === groupId) setActiveGroupId("");
    await load();
  }

  function updateTripName(name: string) {
    if (!state) return;
    setState({ ...state, basics: { ...state.basics, name } });
  }

  if (loading || !state) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-sm text-zinc-600">Loading setup board…</p>
      </div>
    );
  }

  return (
    <SetupBoardLoaded
      tripId={tripId}
      inviteCode={inviteCode}
      timezone={timezone}
      aiBuilderEnabled={aiBuilderEnabled}
      state={state}
      setState={setState}
      sections={sections}
      activeSection={activeSection}
      setActiveSection={setActiveSection}
      activeGroupId={activeGroupId}
      setActiveGroupId={setActiveGroupId}
      saving={saving}
      aiOpen={aiOpen}
      setAiOpen={setAiOpen}
      error={error}
      nameFocused={nameFocused}
      setNameFocused={setNameFocused}
      saveState={saveState}
      createGroup={createGroup}
      deleteGroup={deleteGroup}
      load={load}
      loadReadiness={loadReadiness}
      updateTripName={updateTripName}
    />
  );
}

function SetupBoardLoaded(props: {
  tripId: string;
  inviteCode: string;
  timezone: string;
  aiBuilderEnabled: boolean;
  state: TripSetupState;
  setState: (s: TripSetupState) => void;
  sections: SetupSectionReadiness[];
  activeSection: SetupSectionId;
  setActiveSection: (id: SetupSectionId) => void;
  activeGroupId: string;
  setActiveGroupId: (id: string) => void;
  saving: boolean;
  aiOpen: boolean;
  setAiOpen: (v: boolean) => void;
  error: string | null;
  nameFocused: boolean;
  setNameFocused: (v: boolean) => void;
  saveState: (next?: TripSetupState, scope?: PropagateScope) => Promise<boolean>;
  createGroup: (name: string, type: string) => Promise<void>;
  deleteGroup: (groupId: string) => Promise<void>;
  load: () => Promise<void>;
  loadReadiness: () => Promise<void>;
  updateTripName: (name: string) => void;
}) {
  const {
    tripId,
    inviteCode,
    timezone,
    aiBuilderEnabled,
    state,
    setState,
    sections,
    activeSection,
    setActiveSection,
    activeGroupId,
    setActiveGroupId,
    saving,
    aiOpen,
    setAiOpen,
    error,
    nameFocused,
    setNameFocused,
    saveState,
    createGroup,
    deleteGroup,
    load,
    loadReadiness,
    updateTripName,
  } = props;

  const router = useRouter();
  const groupId = activeGroupId || state.mainGroupId;
  const calendar = useSetupCalendar(state, groupId, setState);
  const sectionSave = (scope?: PropagateScope) => void saveState(undefined, scope);
  const nameNeedsAttention = tripNameNeedsAttention(state.basics.name);
  const [middleView, setMiddleView] = useState<MiddleView>("section");
  const [corridorFocusDate, setCorridorFocusDate] = useState<string | null>(null);
  const [flightFocus, setFlightFocus] = useState<TransportFlightFocus | null>(null);
  const stateRef = useRef(state);
  stateRef.current = state;

  // Auto-save to the server once the trip has a real name.
  useEffect(() => {
    if (tripNameNeedsAttention(state.basics.name)) return;
    const timer = window.setTimeout(() => {
      const current = stateRef.current;
      if (!current || tripNameNeedsAttention(current.basics.name)) return;
      void fetch(`/api/trips/${tripId}/setup`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ state: current, activeGroupId: groupId }),
      })
        .then(() => undefined)
        .catch(() => undefined);
    }, 2500);
    return () => window.clearTimeout(timer);
  }, [tripId, groupId, state]);

  async function handleSaveSetup() {
    if (
      !window.confirm(
        "Save your setup now? Any unsaved changes on this board will be written to the trip.",
      )
    ) {
      return;
    }
    await saveState();
  }

  async function handleBackHome() {
    if (
      !window.confirm(
        "Leave setup and go back to home? Your setup will be saved before you continue.",
      )
    ) {
      return;
    }
    const ok = await saveState();
    if (ok) router.push("/dashboard");
  }

  function handleSectionSelect(id: SetupSectionId) {
    calendar.clearSelection();
    if (id !== "transport") setFlightFocus(null);
    setActiveSection(id);
    setMiddleView("section");
  }

  function handleDayClick(
    iso: string,
    half?: HalfSide,
    options?: { transportClick?: boolean },
  ) {
    setCorridorFocusDate(null);

    if (options?.transportClick) {
      setFlightFocus(null);
      setCorridorFocusDate(iso);
      const selected = calendar.onDayClick(iso, half, options);
      if (selected) {
        setMiddleView("day");
      }
      return;
    }

    const day = calendar.dayPlaces.find((d) => d.date === iso);
    const clickedCity = half && day ? cityOnHalf(day, half).trim() : "";

    setFlightFocus(null);
    const selected = calendar.onDayClick(iso, half, options);
    if (selected) {
      if (clickedCity) setActiveSection("locations");
      setMiddleView("day");
    } else {
      setMiddleView(
        activeSection === "overview" || activeSection === "locations" ? "section" : "empty",
      );
    }
  }

  function openTransportForTransferDay(iso: string) {
    calendar.selectTransferDay(iso);
    setCorridorFocusDate(iso);
    setFlightFocus(null);
    setMiddleView("day");
  }

  function handleTransportCorridorClick(iso: string) {
    openTransportForTransferDay(iso);
  }

  function handleBoundaryClick(boundary: NightBoundary) {
    if (boundary.kind !== "city-change") return;
    openTransportForTransferDay(boundary.date);
  }

  function dismissDayPanel() {
    calendar.clearSelection();
    setCorridorFocusDate(null);
    setMiddleView("section");
  }

  useEffect(() => {
    if (middleView === "day" && !calendar.selection.rangeStart) {
      setMiddleView("section");
    }
  }, [calendar.selection.rangeStart, middleView]);

  function sectionPanel() {
    const meta = sectionMeta(sections, activeSection);
    const readiness = sections.find((s) => s.id === activeSection);

    if (activeSection === "overview") {
      return (
        <SetupOverviewSection state={state} onGoToSection={handleSectionSelect} />
      );
    }
    if (activeSection === "locations") {
      return (
        <SetupLocationsSection
          state={state}
          activeGroupId={groupId}
          calendar={calendar}
          sectionLabel={meta.label}
          sectionMessage={meta.message}
          onChange={setState}
          onSave={(next) => {
            void saveState(next);
          }}
          saving={saving}
        />
      );
    }
    if (activeSection === "transport") {
      return (
        <SetupTransportSection
          tripId={tripId}
          inviteCode={inviteCode}
          state={state}
          activeGroupId={groupId}
          sectionLabel={meta.label}
          sectionMessage={meta.message}
          flightFocus={flightFocus}
          onFlightScheduled={(iso) => {
            calendar.clearSelection();
            calendar.scrollToDate(iso);
            setFlightFocus(null);
          }}
          onChange={setState}
          onSave={sectionSave}
          saving={saving}
        />
      );
    }
    if (activeSection === "accommodation") {
      return (
        <SetupAccommodationSection
          tripId={tripId}
          inviteCode={inviteCode}
          state={state}
          activeGroupId={groupId}
          sectionLabel={meta.label}
          sectionMessage={meta.message}
          onChange={setState}
          onSave={(next, scope) => {
            void saveState(next, scope).then(() => {
              setMiddleView("section");
              calendar.clearSelection();
            });
          }}
          saving={saving}
        />
      );
    }
    if (activeSection === "activities") {
      return (
        <SetupActivitiesSection
          state={state}
          sectionLabel={meta.label}
          sectionMessage={meta.message}
          onChange={setState}
        />
      );
    }
    if (activeSection === "groups") {
      return (
        <SetupGroupsSection
          state={state}
          sectionLabel={meta.label}
          sectionMessage={meta.message}
          onCreateGroup={createGroup}
          onDeleteGroup={deleteGroup}
        />
      );
    }
    if (activeSection === "participants") {
      return (
        <SetupParticipantsSection
          tripId={tripId}
          inviteCode={inviteCode}
          sectionLabel={meta.label}
          sectionMessage={meta.message}
        />
      );
    }
    if (activeSection === "bookings") {
      return (
        <BookingsSection
          tripId={tripId}
          state={state}
          sectionLabel={meta.label}
          sectionMessage={meta.message}
        />
      );
    }
    if (
      activeSection === "emergency" ||
      activeSection === "photos_viewers" ||
      activeSection === "publish"
    ) {
      return (
        <SetupPlaceholderSection
          sectionId={activeSection}
          tripId={tripId}
          state={state}
          activeGroupId={groupId}
          section={readiness}
        />
      );
    }
    return (
      <SetupPlaceholderSection
        sectionId={activeSection}
        tripId={tripId}
        state={state}
        activeGroupId={groupId}
        section={readiness}
      />
    );
  }

  function middleContent() {
    if (middleView === "day" && calendar.selection.rangeStart) {
      return (
        <SetupDayContextPanel
          state={state}
          selection={calendar.selection}
          corridorFocusDate={corridorFocusDate}
          onSelectionChange={calendar.selectDayFocus}
          onChange={setState}
          onDismiss={dismissDayPanel}
          onSave={(next) => {
            dismissDayPanel();
            void saveState(next);
          }}
          onConfirmed={dismissDayPanel}
          onFlightScheduled={(iso) => {
            calendar.clearSelection();
            calendar.scrollToDate(iso);
            setMiddleView("section");
            setActiveSection("transport");
          }}
          saving={saving}
          inviteCode={inviteCode}
        />
      );
    }
    if (middleView === "section") {
      return sectionPanel();
    }
    return null;
  }

  return (
    <div className="flex h-full min-h-0 flex-col border-r border-zinc-200 bg-white">
      <div className="flex shrink-0 border-b border-zinc-200">
        <div className="w-56 shrink-0 border-r border-zinc-200 px-4 py-3">
          <h2 className="text-lg font-semibold tracking-tight text-zinc-900">Itinerary Live</h2>
          <input
            value={state.basics.name}
            onChange={(e) => updateTripName(e.target.value)}
            onFocus={() => setNameFocused(true)}
            onBlur={() => {
              setNameFocused(false);
              if (!tripNameNeedsAttention(state.basics.name)) void saveState();
            }}
            placeholder="Trip name"
            className={[
              "mt-1 w-full border-0 bg-transparent p-0 text-sm font-medium text-zinc-800 outline-none",
              nameNeedsAttention && !nameFocused ? "italic text-zinc-400" : "",
            ].join(" ")}
            aria-label="Trip name"
          />
          {nameNeedsAttention ? (
            <p className="mt-1 text-xs text-amber-700">
              Name this trip to save to the cloud — your work is kept in this tab meanwhile.
            </p>
          ) : null}
        </div>
        <div className="flex min-w-0 flex-1 items-center border-r-2 border-zinc-300 px-4 py-3">
          <h2 className="text-lg font-semibold tracking-tight text-zinc-900">Workspace</h2>
        </div>
        <div className="flex w-1/2 min-w-[420px] shrink-0 items-center px-4 py-3">
          <h2 className="text-lg font-semibold tracking-tight text-zinc-900">Calendar</h2>
        </div>
      </div>

      <div className="flex min-h-0 flex-1">
        <aside className="flex w-56 shrink-0 flex-col border-r border-zinc-200 bg-white">
          {error ? (
            <div className="shrink-0 border-b border-red-200 bg-red-50 px-4 py-2 text-sm text-red-800">
              {error}
            </div>
          ) : null}

          <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3">
            <SetupSectionNav
              sections={sections}
              active={activeSection}
              onSelect={handleSectionSelect}
            />
          </div>

          <div className="shrink-0 border-t border-zinc-200 bg-zinc-50/80">
            {aiBuilderEnabled ? (
              aiOpen ? (
                <div className="max-h-[40vh] overflow-hidden">
                  <AiChatPanel
                    tripId={tripId}
                    inviteCode={inviteCode}
                    timezone={timezone}
                    startDate={state.basics.startDate}
                    endDate={state.basics.endDate}
                    onClose={() => setAiOpen(false)}
                    onApplied={() => {
                      void load();
                      void loadReadiness();
                    }}
                  />
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setAiOpen(true)}
                  className="flex w-full items-center justify-between px-4 py-3 text-left text-sm font-medium text-zinc-800 hover:bg-zinc-100"
                >
                  AI assistant
                  <span className="text-xs text-zinc-500">Import & build</span>
                </button>
              )
            ) : null}
            <div className="flex gap-2 border-t border-zinc-200 p-3">
              <button
                type="button"
                disabled={saving}
                onClick={() => void handleBackHome()}
                className="flex-1 rounded-lg border border-zinc-200 px-3 py-2.5 text-sm font-medium text-zinc-700 hover:bg-zinc-100 disabled:opacity-50"
              >
                ← Back to home
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={() => void handleSaveSetup()}
                className="flex-1 rounded-lg bg-zinc-900 px-3 py-2.5 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50"
              >
                {saving ? "Saving…" : "Save setup"}
              </button>
            </div>
          </div>
        </aside>

        <div className="flex min-h-0 min-w-0 flex-1 border-r-2 border-zinc-300">
          <SetupMiddleWorkspace
            onEmptyClick={() => {
              calendar.clearSelection();
              setMiddleView("section");
            }}
          >
            {middleContent()}
          </SetupMiddleWorkspace>
        </div>

        <div className="flex h-full w-1/2 min-w-[420px] shrink-0 flex-col">
          <SetupPersistentCalendar
            state={state}
            activeGroupId={groupId}
            onCreateGroup={createGroup}
            onSelectGroup={setActiveGroupId}
            calendar={calendar}
            onDayClick={handleDayClick}
            onBoundaryClick={handleBoundaryClick}
            onTransportCorridorClick={handleTransportCorridorClick}
          />
        </div>
      </div>

      <TransportMoveWarningModal
        open={Boolean(calendar.pendingBoundaryMove)}
        reason={calendar.pendingBoundaryMove?.reason ?? ""}
        onClose={calendar.cancelPendingBoundaryMove}
        onConfirm={() => {
          calendar.confirmPendingBoundaryMove();
          dismissDayPanel();
        }}
      />
    </div>
  );
}
