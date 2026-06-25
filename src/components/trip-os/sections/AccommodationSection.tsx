"use client";

import { useMemo, useState } from "react";

import { homestayPeriodStays, nonHomestayStays } from "@/lib/host/accommodation/homestay-helpers";
import { stayTypeLabel } from "@/lib/host/accommodation/stay-type-labels";
import type { AccommodationStayDraft } from "@/lib/host/wizard/types";
import {
  stayFinanceDisplayStatus,
  stayFinanceAttentionById,
  stayFinanceAttentionReason,
  stayFinanceLineId,
  type EntityFinanceDisplayStatus,
} from "@/lib/trip-engine/cost-ledger/finance-section-readiness";
import type { CostLedgerProjection } from "@/lib/trip-engine/cost-ledger/types";
import type { FinanceBuiltInSection } from "@/lib/trip-engine/cost-ledger/finance-sections";
import { staysListedByScope, type TripScopeSection } from "@/lib/trip-engine/section-scope-lists";
import type { TripEntityGraph, RosterSummary } from "@/lib/trip-engine/types";
import type { TripCommand } from "@/lib/trip-engine/commands";

import { AddRoomsModal } from "../accommodation/AddRoomsModal";
import { AddHomestaysModal } from "../homestay/AddHomestaysModal";
import { FinanceLineStatusBadge } from "../shared/FinanceLineStatusBadge";
import { FinanceEntityQuickActions } from "../shared/FinanceEntityQuickActions";
import { TripScopedSectionHeader } from "../shared/TripScopedSectionHeader";
import { HomestaysPanel } from "./HomestaysPanel";
import { TripSectionShell, TripSoftPanel } from "../shared/TripSectionShell";
import type { CostsPatchResult } from "../useTripOsEngine";

function PanelActionButton(props: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  title?: string;
}) {
  return (
    <button
      type="button"
      onClick={props.onClick}
      disabled={props.disabled}
      title={props.title}
      className="rounded-full bg-zinc-900 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:bg-zinc-300"
    >
      {props.children}
    </button>
  );
}

function StayListItem(props: {
  stay: AccommodationStayDraft;
  scopeHint?: string | null;
  financeStatus: EntityFinanceDisplayStatus;
  financeAttentionReason?: string | null;
  onOpenFinance?: () => void;
  showFinanceActions?: boolean;
  saving?: boolean;
  onMarkTbc?: () => void;
}) {
  const { stay } = props;
  return (
    <li className="flex items-center justify-between gap-3 rounded-2xl bg-white px-4 py-3 shadow-sm">
      <div className="min-w-0">
        <p className="font-medium text-zinc-900">{stay.name || "Unnamed stay"}</p>
        <p className="text-sm text-zinc-500">
          {stayTypeLabel(stay.stayType)} · {stay.cityLabel} · {stay.checkInDate} →{" "}
          {stay.checkOutDate}
        </p>
        {props.scopeHint ? (
          <p className="mt-1 text-xs text-violet-700">{props.scopeHint}</p>
        ) : stay.notes?.trim() ? (
          <p className="mt-1 text-xs text-amber-800">{stay.notes}</p>
        ) : null}
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <FinanceEntityQuickActions
          show={Boolean(props.showFinanceActions)}
          saving={props.saving}
          onTbc={props.onMarkTbc}
        />
        <FinanceLineStatusBadge
          status={props.financeStatus}
          attentionReason={props.financeAttentionReason}
          onNeedsAttention={props.onOpenFinance}
        />
      </div>
    </li>
  );
}

function AccommodationEmptyState() {
  return (
    <p className="py-8 text-center text-sm leading-relaxed text-zinc-500">
      No accommodation on the calendar yet. Select days on the trip calendar and use{" "}
      <span className="font-medium text-zinc-700">Accommodation → Add</span> there.
    </p>
  );
}

function homestayPeriodForAction(
  periods: AccommodationStayDraft[],
  selectedDate?: string | null,
): AccommodationStayDraft | null {
  if (!periods.length) return null;
  if (selectedDate) {
    const match = periods.find(
      (p) => selectedDate >= p.checkInDate && selectedDate < p.checkOutDate,
    );
    if (match) return match;
  }
  return periods[0] ?? null;
}

function scopeEditHint(
  graph: TripEntityGraph,
  viewGroupId: string,
  scope: TripScopeSection<AccommodationStayDraft>,
): string | null {
  if (scope.groupId === graph.mainGroupId) return null;
  if (viewGroupId === scope.groupId) return null;
  return `Edit on ${scope.title}'s calendar`;
}

export function AccommodationSection(props: {
  graph: TripEntityGraph;
  groupId: string;
  tripId: string;
  inviteCode: string;
  rosterSummary?: RosterSummary;
  selectedDate?: string | null;
  saving?: boolean;
  onDispatch: (commands: TripCommand[]) => Promise<boolean>;
  onReload?: () => void;
  costLedger?: CostLedgerProjection | null;
  onOpenFinanceSection?: (section: FinanceBuiltInSection, lineId?: string) => void;
  onCostsAction?: (payload: Record<string, unknown>) => Promise<CostsPatchResult>;
}) {
  const [roomsModalOpen, setRoomsModalOpen] = useState(false);
  const [homestaysModalOpen, setHomestaysModalOpen] = useState(false);
  const [actionScopeId, setActionScopeId] = useState<string | null>(null);

  const roster = props.rosterSummary ?? { participants: [], groups: [], rooms: [] };
  const homestayStudents = useMemo(
    () => roster.participants.filter((p) => p.role === "student"),
    [roster.participants],
  );

  const scopedStays = useMemo(
    () => staysListedByScope(props.graph, roster, props.groupId),
    [props.graph, roster, props.groupId],
  );

  const stayFinanceAttention = useMemo(
    () => stayFinanceAttentionById(props.costLedger),
    [props.costLedger],
  );

  const allScopes = useMemo(
    () => [scopedStays.wholeGroup, ...scopedStays.otherScopes],
    [scopedStays],
  );

  const actionScope =
    allScopes.find((scope) => scope.groupId === (actionScopeId ?? props.groupId)) ??
    scopedStays.wholeGroup;

  const viewScope = allScopes.find((scope) => scope.groupId === props.groupId);
  const viewStays = viewScope?.items ?? [];
  const hotelStaysForRooms = nonHomestayStays(actionScope.items).filter((s) => s.name?.trim());

  const homestayPeriods = homestayPeriodStays(viewStays);
  const homestayTarget = homestayPeriodForAction(
    homestayPeriodStays(actionScope.items),
    props.selectedDate,
  );
  const hasAnyStays = allScopes.some((scope) => scope.items.length > 0);

  function openStayFinance(stayId: string) {
    const lineId =
      stayFinanceAttention.get(stayId) ?? stayFinanceLineId(stayId, props.costLedger);
    props.onOpenFinanceSection?.("accommodation", lineId ?? undefined);
  }

  async function markStayTbc(stayId: string) {
    if (!props.onCostsAction) return;
    const lineId =
      stayFinanceAttention.get(stayId) ?? stayFinanceLineId(stayId, props.costLedger);
    if (!lineId) return;
    await props.onCostsAction({
      action: "updateLine",
      lineId,
      line: { costStatus: "tbc" },
    });
  }

  function scopeHeaderAction(scope: TripScopeSection<AccommodationStayDraft>) {
    const isActiveScope = scope.groupId === props.groupId;
    if (!isActiveScope) return undefined;

    const hasHomestayPeriods = homestayPeriodStays(scope.items).length > 0;
    const hasHotels = nonHomestayStays(scope.items).some((s) => s.name?.trim());

    if (scope.groupId === props.graph.mainGroupId || hasHotels) {
      return (
        <PanelActionButton
          onClick={() => {
            setActionScopeId(scope.groupId);
            setRoomsModalOpen(true);
          }}
        >
          Add rooms
        </PanelActionButton>
      );
    }

    if (hasHomestayPeriods) {
      return (
        <PanelActionButton
          onClick={() => {
            setActionScopeId(scope.groupId);
            setHomestaysModalOpen(true);
          }}
          disabled={!homestayPeriodForAction(homestayPeriodStays(scope.items), props.selectedDate)}
          title="Add a homestay period on the calendar first"
        >
          Add homestays
        </PanelActionButton>
      );
    }

    return undefined;
  }

  function renderScope(scope: TripScopeSection<AccommodationStayDraft>) {
    if (!scope.items.length) return null;

    const isWholeGroup = scope.groupId === props.graph.mainGroupId;
    const scopeHint = scopeEditHint(props.graph, props.groupId, scope);

    return (
      <div key={scope.groupId} className={isWholeGroup ? undefined : "mt-8"}>
        <TripScopedSectionHeader
          title={scope.title}
          memberNames={scope.memberNames}
          isWholeGroup={isWholeGroup}
          headerAction={scopeHeaderAction(scope)}
        />
        <ul className="space-y-2">
          {scope.items.map((s) => (
            <StayListItem
              key={s.id}
              stay={s}
              scopeHint={scopeHint}
              financeStatus={stayFinanceDisplayStatus(s.id, props.costLedger)}
              financeAttentionReason={stayFinanceAttentionReason(s.id, props.costLedger)}
              onOpenFinance={() => openStayFinance(s.id)}
              showFinanceActions={
                stayFinanceDisplayStatus(s.id, props.costLedger) === "needs_attention" &&
                Boolean(props.onCostsAction)
              }
              saving={props.saving}
              onMarkTbc={() => void markStayTbc(s.id)}
            />
          ))}
        </ul>
      </div>
    );
  }

  return (
    <TripSectionShell
      title="Accommodation"
      description="Whole-group stays first, then personal or subgroup stays with who they belong to."
    >
      {!hasAnyStays ? (
        <TripSoftPanel>
          <AccommodationEmptyState />
        </TripSoftPanel>
      ) : (
        <>{allScopes.map((scope) => renderScope(scope))}</>
      )}

      {homestayPeriods.length ? (
        <div className="mt-6">
          <HomestaysPanel
            tripId={props.tripId}
            groupId={props.groupId}
            graph={props.graph}
            stays={viewStays}
            roster={roster}
            selectedDate={props.selectedDate}
            saving={props.saving}
            onDispatch={props.onDispatch}
          />
        </div>
      ) : null}

      <AddRoomsModal
        open={roomsModalOpen}
        onClose={() => setRoomsModalOpen(false)}
        tripId={props.tripId}
        inviteCode={props.inviteCode}
        hotelStays={hotelStaysForRooms}
        roster={roster}
        onSaved={() => props.onReload?.()}
      />

      <AddHomestaysModal
        open={homestaysModalOpen}
        onClose={() => setHomestaysModalOpen(false)}
        tripId={props.tripId}
        groupId={actionScope.groupId}
        cityLabel={homestayTarget?.cityLabel ?? ""}
        checkIn={homestayTarget?.checkInDate ?? ""}
        checkOut={homestayTarget?.checkOutDate ?? ""}
        students={homestayStudents}
        onDispatch={props.onDispatch}
        onSaved={() => props.onReload?.()}
      />
    </TripSectionShell>
  );
}
